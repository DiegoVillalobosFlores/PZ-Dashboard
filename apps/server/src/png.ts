import { deflateSync, inflateSync } from "node:zlib";
import type { DecodedPng } from "../../../packages/core";

const PNG_SIGNATURE = 0x89504e47;

export function decodePng(bytes: Uint8Array): DecodedPng {
  const png = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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
  const rgba = Buffer.alloc(height * stride);

  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++]!;
    const line = raw.subarray(read, read + stride);
    read += stride;
    const rowStart = y * stride;

    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? rgba[rowStart + i - 4]! : 0;
      const up = y > 0 ? rgba[rowStart - stride + i]! : 0;
      const upLeft = y > 0 && i >= 4 ? rgba[rowStart - stride + i - 4]! : 0;
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
      rgba[rowStart + i] = out & 0xff;
    }
  }

  return { width, height, rgba };
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

export function encodePng({ width, height, rgba }: DecodedPng): Uint8Array<ArrayBuffer> {
  const pixels = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
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

  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]));
}
