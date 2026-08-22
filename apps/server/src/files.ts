import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { inflateRawSync } from "node:zlib";
import type { Codecs, GameFiles } from "../../../packages/core";
import { parseZip } from "../../../packages/core/zip";
import { decodePng, encodePng } from "./png";

export function makeNodeFiles(): GameFiles {
  return {
    async read(path) { return new Uint8Array(await readFile(path)); },
    list(path) { return readdir(path); },
    async stat(path) {
      try { return await stat(path); } catch { return null; }
    },
    async write(path, data) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    },
  };
}

export const nodeCodecs: Codecs = {
  decodePng,
  encodePng,
  inflateZip(bytes) {
    return parseZip(bytes, (data) => inflateRawSync(data));
  },
};
