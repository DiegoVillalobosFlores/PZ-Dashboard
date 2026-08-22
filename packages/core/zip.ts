const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT = 0xffff;

export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export type InflateRaw = (data: Uint8Array, uncompressedSize: number) => Uint8Array | Promise<Uint8Array>;

function latin1(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[start + i]!);
  return out;
}

function findEndOfCentralDirectory(view: DataView, size: number): number {
  const earliest = Math.max(0, size - EOCD_MIN_SIZE - MAX_COMMENT);
  for (let pos = size - EOCD_MIN_SIZE; pos >= earliest; pos--) {
    if (view.getUint32(pos, true) === EOCD_SIGNATURE) return pos;
  }
  throw new Error("not a zip archive (no end-of-central-directory record)");
}

export function readCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view, bytes.byteLength);
  const count = view.getUint16(eocd + 10, true);
  const offset = view.getUint32(eocd + 16, true);
  if (offset === 0xffffffff || count === 0xffff) {
    throw new Error("zip64 archives are not supported");
  }

  const entries: ZipEntry[] = [];
  let pos = offset;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== CENTRAL_SIGNATURE) {
      throw new Error(`corrupt zip central directory at ${pos}`);
    }
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    entries.push({
      name: latin1(bytes, pos + 46, nameLength),
      method: view.getUint16(pos + 10, true),
      compressedSize: view.getUint32(pos + 20, true),
      uncompressedSize: view.getUint32(pos + 24, true),
      localHeaderOffset: view.getUint32(pos + 42, true),
    });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function listZip(bytes: Uint8Array): string[] {
  return readCentralDirectory(bytes).map((entry) => entry.name);
}

function entryData(bytes: Uint8Array, view: DataView, entry: ZipEntry): Uint8Array {
  const header = entry.localHeaderOffset;
  if (view.getUint32(header, true) !== LOCAL_SIGNATURE) {
    throw new Error(`corrupt zip local header for "${entry.name}"`);
  }
  const start = header + 30 + view.getUint16(header + 26, true) + view.getUint16(header + 28, true);
  return bytes.subarray(start, start + entry.compressedSize);
}

export async function parseZip(bytes: Uint8Array, inflateRaw: InflateRaw): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, Uint8Array>();

  for (const entry of readCentralDirectory(bytes)) {
    if (entry.name.endsWith("/")) continue;
    const data = entryData(bytes, view, entry);
    if (entry.method === 0) out.set(entry.name, data);
    else if (entry.method === 8) out.set(entry.name, await inflateRaw(data, entry.uncompressedSize));
    else throw new Error(`unsupported zip compression method ${entry.method} for "${entry.name}"`);
  }

  return out;
}
