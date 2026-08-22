import { join } from "node:path";
import type { Codecs, DecodedPng, GameFiles } from "./index";

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

let index: Map<string, IconEntry> | null = null;

async function getIndex(files: GameFiles, installDir: string): Promise<Map<string, IconEntry>> {
  if (index) return index;
  index = new Map();
  if (!installDir) return index;

  const dir = join(installDir, "media", "texturepacks");
  for (const name of await files.list(dir)) {
    if (!name.endsWith(".pack")) continue;
    try {
      readPack(join(dir, name), await files.read(join(dir, name)), index);
    } catch (err) {
      console.warn(`[icons] skipped ${name}: ${err}`);
    }
  }
  console.log(`[icons] indexed ${index.size} textures from ${dir}`);
  return index;
}

const pages = new Map<string, DecodedPng>();

async function getPage(files: GameFiles, codecs: Codecs, entry: IconEntry): Promise<DecodedPng> {
  const key = `${entry.file}:${entry.pngOffset}`;
  const cached = pages.get(key);
  if (cached) return cached;

  const bytes = await files.read(entry.file);
  const png = bytes.subarray(entry.pngOffset, entry.pngOffset + entry.pngLength);

  const page = await codecs.decodePng(png);
  if (pages.size >= MAX_CACHED_PAGES) pages.delete(pages.keys().next().value!);
  pages.set(key, page);
  return page;
}

const rendered = new Map<string, Uint8Array<ArrayBuffer>>();

export async function renderIcon(files: GameFiles, codecs: Codecs, installDir: string, name: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const cached = rendered.get(name);
  if (cached) return cached;

  const entry = (await getIndex(files, installDir)).get(name);
  if (!entry) return null;

  const page = await getPage(files, codecs, entry);
  const width = Math.min(entry.w, page.width - entry.x);
  const height = Math.min(entry.h, page.height - entry.y);
  if (width <= 0 || height <= 0) return null;

  const rgba = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((entry.y + row) * page.width + entry.x) * 4;
    rgba.set(page.rgba.subarray(from, from + width * 4), row * width * 4);
  }

  const png = await codecs.encodePng({ width, height, rgba });
  rendered.set(name, png);
  return png;
}
