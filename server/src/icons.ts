import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { PZ_INSTALL_DIR } from "./config";

type IconEntry = { file: string; pngOffset: number; pngLength: number; x: number; y: number; w: number; h: number };
type Bitmap = { width: number; height: number; pixels: Buffer };

const PNG_SIGNATURE = 0x89504e47;
const MAX_CACHED_PAGES = 4;

function packReader(path: string) {
  const fd = openSync(path, "r");
  const size = statSync(path).size;
  let base = 0;
  let window = Buffer.alloc(0);

  function ensure(pos: number, length: number) {
    if (pos >= base && pos + length <= base + window.length) return;
    base = pos;
    window = Buffer.alloc(Math.max(0, Math.min(Math.max(length, 1 << 18), size - pos)));
    readSync(fd, window, 0, window.length, pos);
  }

  return {
    close: () => closeSync(fd),
    ascii(pos: number, length: number) {
      ensure(pos, length);
      return window.toString("latin1", pos - base, pos - base + length);
    },
    int(pos: number) {
      ensure(pos, 4);
      return window.readInt32LE(pos - base);
    },
    uintBE(pos: number) {
      ensure(pos, 4);
      return window.readUInt32BE(pos - base);
    },
  };
}

function pngLength(reader: ReturnType<typeof packReader>, start: number): number {
  let pos = start + 8;
  for (;;) {
    const length = reader.uintBE(pos);
    const type = reader.ascii(pos + 4, 4);
    pos += 12 + length;
    if (type === "IEND") return pos - start;
  }
}

function readPack(file: string, into: Map<string, IconEntry>) {
  const reader = packReader(file);
  try {
    let pos = 0;
    const int = () => {
      const value = reader.int(pos);
      pos += 4;
      return value;
    };
    const str = () => {
      const length = int();
      const value = reader.ascii(pos, length);
      pos += length;
      return value;
    };

    const versioned = reader.ascii(0, 4) === "PZPK";
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
        pngLen = pngLength(reader, pos);
        pos += pngLen + 4;
      }

      for (const texture of textures) {
        if (!into.has(texture.name)) into.set(texture.name, { file, pngOffset, pngLength: pngLen, ...texture });
      }
    }
  } finally {
    reader.close();
  }
}

let index: Map<string, IconEntry> | null = null;

function getIndex(): Map<string, IconEntry> {
  if (index) return index;
  index = new Map();
  if (!PZ_INSTALL_DIR) return index;

  const dir = join(PZ_INSTALL_DIR, "media", "texturepacks");
  if (!existsSync(dir)) {
    console.warn(`[icons] no texture packs at ${dir} - item icons will 404`);
    return index;
  }

  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".pack")) continue;
    try {
      readPack(join(dir, name), index);
    } catch (err) {
      console.warn(`[icons] skipped ${name}: ${err}`);
    }
  }
  console.log(`[icons] indexed ${index.size} textures from ${dir}`);
  return index;
}

function decodePng(png: Buffer): Bitmap {
  if (png.readUInt32BE(0) !== PNG_SIGNATURE) throw new Error("not a PNG");

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const parts: Buffer[] = [];

  let pos = 8;
  while (pos < png.length) {
    const length = png.readUInt32BE(pos);
    const type = png.toString("latin1", pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      interlace = data[12]!;
    } else if (type === "IDAT") {
      parts.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }

  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`unsupported PNG (bitDepth ${bitDepth}, colorType ${colorType}, interlace ${interlace})`);
  }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);

  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++]!;
    const line = raw.subarray(read, read + stride);
    read += stride;
    const rowStart = y * stride;

    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? pixels[rowStart + i - 4]! : 0;
      const up = y > 0 ? pixels[rowStart - stride + i]! : 0;
      const upLeft = y > 0 && i >= 4 ? pixels[rowStart - stride + i - 4]! : 0;
      const value = line[i]!;

      let out: number;
      if (filter === 0) out = value;
      else if (filter === 1) out = value + left;
      else if (filter === 2) out = value + up;
      else if (filter === 3) out = value + ((left + up) >> 1);
      else {
        const estimate = left + up - upLeft;
        const dLeft = Math.abs(estimate - left);
        const dUp = Math.abs(estimate - up);
        const dUpLeft = Math.abs(estimate - upLeft);
        out = value + (dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft);
      }
      pixels[rowStart + i] = out & 0xff;
    }
  }

  return { width, height, pixels };
}

const CRC_TABLE = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "latin1"), data])), 8 + data.length);
  return out;
}

function encodePng({ width, height, pixels }: Bitmap): Buffer {
  const stride = width * 4;
  const rows = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rows[y * (stride + 1)] = 0;
    pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const pages = new Map<string, Bitmap>();

function getPage(entry: IconEntry): Bitmap {
  const key = `${entry.file}:${entry.pngOffset}`;
  const cached = pages.get(key);
  if (cached) return cached;

  const png = Buffer.alloc(entry.pngLength);
  const fd = openSync(entry.file, "r");
  try {
    readSync(fd, png, 0, png.length, entry.pngOffset);
  } finally {
    closeSync(fd);
  }

  const page = decodePng(png);
  if (pages.size >= MAX_CACHED_PAGES) pages.delete(pages.keys().next().value!);
  pages.set(key, page);
  return page;
}

const rendered = new Map<string, Buffer>();

export function renderIcon(name: string): Buffer | null {
  const cached = rendered.get(name);
  if (cached) return cached;

  const entry = getIndex().get(name);
  if (!entry) return null;

  const page = getPage(entry);
  const width = Math.min(entry.w, page.width - entry.x);
  const height = Math.min(entry.h, page.height - entry.y);
  if (width <= 0 || height <= 0) return null;

  const pixels = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((entry.y + row) * page.width + entry.x) * 4;
    page.pixels.copy(pixels, row * width * 4, from, from + width * 4);
  }

  const png = encodePng({ width, height, pixels });
  rendered.set(name, png);
  return png;
}
