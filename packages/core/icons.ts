import type { Codecs, DecodedPng, GameFiles } from "./index";
import { joinPath } from "./path";

type IconEntry = { file: string; pngOffset: number; pngLength: number; x: number; y: number; w: number; h: number };

const MAX_CACHED_PAGES = 4;

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ascii(bytes: Uint8Array, pos: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[pos + i]!);
  return out;
}

function pngLength(bytes: Uint8Array, view: DataView, start: number): number {
  let pos = start + 8;
  for (;;) {
    const length = view.getUint32(pos, false);
    const type = ascii(bytes, pos + 4, 4);
    pos += 12 + length;
    if (type === "IEND") return pos - start;
  }
}

function readPack(file: string, bytes: Uint8Array, into: Map<string, IconEntry>) {
  const view = viewOf(bytes);
  let pos = 0;
  const int = () => {
    const value = view.getInt32(pos, true);
    pos += 4;
    return value;
  };
  const str = () => {
    const length = int();
    const value = ascii(bytes, pos, length);
    pos += length;
    return value;
  };

  const versioned = ascii(bytes, 0, 4) === "PZPK";
  if (versioned) {
    pos = 4;
    int();
  }

  const pageCount = int();
  for (let page = 0; page < pageCount; page++) {
    str();
    const textureCount = int();
    int();

    const textures: { name: string; x: number; y: number; w: number; h: number }[] = [];
    for (let t = 0; t < textureCount; t++) {
      const name = str();
      const x = int();
      const y = int();
      const w = int();
      const h = int();
      pos += 16;
      textures.push({ name, x, y, w, h });
    }

    let pngOffset: number;
    let pngLen: number;
    if (versioned) {
      pngLen = int();
      pngOffset = pos;
      pos += pngLen;
    } else {
      pngOffset = pos;
      pngLen = pngLength(bytes, view, pos);
      pos += pngLen + 4;
    }

    for (const texture of textures) {
      if (!into.has(texture.name)) into.set(texture.name, { file, pngOffset, pngLength: pngLen, ...texture });
    }
  }
}

const indexes = new WeakMap<GameFiles, Promise<Map<string, IconEntry>>>();

async function getIndex(files: GameFiles, installDir: string): Promise<Map<string, IconEntry>> {
  const cached = indexes.get(files);
  if (cached) return cached;
  const promise = (async () => {
    const index = new Map<string, IconEntry>();
    if (!installDir) return index;

    const dir = joinPath(installDir, "media", "texturepacks");
    for (const name of await files.list(dir)) {
      if (!name.endsWith(".pack")) continue;
      try {
        readPack(joinPath(dir, name), await files.read(joinPath(dir, name)), index);
      } catch (err) {
        console.warn(`[icons] skipped ${name}: ${err}`);
      }
    }
    console.log(`[icons] indexed ${index.size} textures from ${dir}`);
    return index;
  })();
  indexes.set(files, promise);
  return promise;
}

const pages = new WeakMap<GameFiles, Map<string, DecodedPng>>();

function cacheKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function encodePage(page: DecodedPng): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(8 + page.rgba.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, page.width, true);
  view.setUint32(4, page.height, true);
  bytes.set(page.rgba, 8);
  return bytes;
}

function decodePage(bytes: Uint8Array): DecodedPng | null {
  if (bytes.byteLength < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  if (width <= 0 || height <= 0 || bytes.byteLength !== 8 + width * height * 4) return null;
  return { width, height, rgba: bytes.slice(8) };
}

async function getPage(files: GameFiles, codecs: Codecs, entry: IconEntry, cacheDir?: string): Promise<DecodedPng> {
  const key = `${entry.file}:${entry.pngOffset}`;
  const pageCache = pages.get(files) ?? new Map<string, DecodedPng>();
  pages.set(files, pageCache);
  const cached = pageCache.get(key);
  if (cached) return cached;

  const cachePath = cacheDir ? joinPath(cacheDir, "icons", "pages", `${cacheKey(key)}.rgba`) : null;
  if (cachePath) {
    const page = decodePage(await files.read(cachePath).catch(() => new Uint8Array()));
    if (page) {
      pageCache.set(key, page);
      return page;
    }
  }

  const bytes = await files.read(entry.file);
  const png = bytes.subarray(entry.pngOffset, entry.pngOffset + entry.pngLength);

  const page = await codecs.decodePng(png);
  if (pageCache.size >= MAX_CACHED_PAGES) pageCache.delete(pageCache.keys().next().value!);
  pageCache.set(key, page);
  if (cachePath) await files.write(cachePath, encodePage(page)).catch(() => undefined);
  return page;
}

const rendered = new WeakMap<GameFiles, Map<string, Uint8Array<ArrayBuffer>>>();

export async function renderIcon(files: GameFiles, codecs: Codecs, installDir: string, name: string, cacheDir?: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const cachePath = cacheDir ? joinPath(cacheDir, "icons", "rendered", `${name}.png`) : null;
  const cachedFile = cachePath ? await files.read(cachePath).catch(() => null) : null;
  if (cachedFile) return cachedFile;

  const renderedKey = `${installDir}\0${cacheDir ?? ""}\0${name}`;
  const renderCache = rendered.get(files) ?? new Map<string, Uint8Array<ArrayBuffer>>();
  rendered.set(files, renderCache);
  const cached = renderCache.get(renderedKey);
  if (cached) return cached;

  const entry = (await getIndex(files, installDir)).get(name);
  if (!entry) return null;

  const page = await getPage(files, codecs, entry, cacheDir);
  const width = Math.min(entry.w, page.width - entry.x);
  const height = Math.min(entry.h, page.height - entry.y);
  if (width <= 0 || height <= 0) return null;

  const rgba = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((entry.y + row) * page.width + entry.x) * 4;
    rgba.set(page.rgba.subarray(from, from + width * 4), row * width * 4);
  }

  const png = await codecs.encodePng({ width, height, rgba });
  renderCache.set(renderedKey, png);
  if (cachePath) await files.write(cachePath, png).catch(() => undefined);
  return png;
}
