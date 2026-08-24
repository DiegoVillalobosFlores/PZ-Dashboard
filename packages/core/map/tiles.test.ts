import { expect, test } from "bun:test";
import type { Codecs, GameFiles } from "../index";
import { getTilePath, getWorldToPixelTransform, worldToTile } from "./tiles";

function memoryFiles(): GameFiles & { store: Map<string, Uint8Array<ArrayBuffer>>; reads: number } {
  const store = new Map<string, Uint8Array<ArrayBuffer>>();
  const files = {
    store,
    reads: 0,
    async read(path: string) {
      const value = store.get(path);
      if (!value) throw new Error(`ENOENT ${path}`);
      if (path.endsWith(".zip")) files.reads++;
      return value;
    },
    async list() {
      return [];
    },
    async stat(path: string) {
      return store.has(path) ? { mtimeMs: 0 } : null;
    },
    async write(path: string, content: Uint8Array<ArrayBuffer> | string) {
      store.set(path, typeof content === "string" ? new TextEncoder().encode(content) : content);
    },
  };
  return files;
}

const codecs = {
  decodePng: () => {
    throw new Error("unused");
  },
  encodePng: () => {
    throw new Error("unused");
  },
  inflateZip: () => new Map([["3/tile1x1.png", new Uint8Array([1, 2, 3])]]),
} as unknown as Codecs;

test("re-extracts when the tile cache is evicted after a successful extraction", async () => {
  const files = memoryFiles();
  files.store.set("/install/media/maps/KY/spawnSelectImagePyramid.zip", new Uint8Array([0]));

  const path = await getTilePath(files, codecs, "/install", "/cache", "KY", 3, 1, 1);
  expect(files.store.has(path)).toBe(true);
  expect(files.reads).toBe(1);

  for (const key of [...files.store.keys()]) {
    if (key.startsWith("/cache/")) files.store.delete(key);
  }

  const again = await getTilePath(files, codecs, "/install", "/cache", "KY", 3, 1, 1);
  expect(again).toBe(path);
  expect(files.store.has(again)).toBe(true);
  expect(files.reads).toBe(2);
});

test("repairs a region at most once for tiles the pyramid never contained", async () => {
  const files = memoryFiles();
  files.store.set("/install/media/maps/WP/spawnSelectImagePyramid.zip", new Uint8Array([0]));

  await getTilePath(files, codecs, "/install", "/cache", "WP", 3, 1, 1);
  expect(files.reads).toBe(1);

  await getTilePath(files, codecs, "/install", "/cache", "WP", 9, 9, 9);
  expect(files.reads).toBe(2);

  await getTilePath(files, codecs, "/install", "/cache", "WP", 9, 9, 8);
  await getTilePath(files, codecs, "/install", "/cache", "WP", 9, 8, 9);
  expect(files.reads).toBe(2);
});

test("exposes the measured transform and keeps pixel offsets non-negative", () => {
  const transform = getWorldToPixelTransform("Muldraugh, KY");
  expect(transform?.scaleX).toBe(0.5);
  expect(transform?.scaleY).toBe(0.5);
  expect(transform?.originX).toBe(122);
  expect(transform?.originY).toBe(123);
  // Muldraugh's own map.info view center, at the tile it lands on under the
  // fit scripts/map-alignment.ts measured.
  const location = worldToTile("Muldraugh, KY", 11181, 9725, 0);
  expect(location.tileX).toBe(22);
  expect(location.tileY).toBe(19);
  expect(location.pixelXInTile).toBeGreaterThanOrEqual(0);
  expect(location.pixelYInTile).toBeGreaterThanOrEqual(0);
});

test("halves the whole pixel grid per zoom level, origin included", () => {
  const TILE_SIZE = 256;
  const zero = worldToTile("Muldraugh, KY", 11181, 9725, 0);
  const one = worldToTile("Muldraugh, KY", 11181, 9725, 1);
  const pixelAt = (location: typeof zero) => ({
    x: location.tileX * TILE_SIZE + location.pixelXInTile,
    y: location.tileY * TILE_SIZE + location.pixelYInTile,
  });
  expect(pixelAt(one).x).toBeCloseTo(pixelAt(zero).x / 2, 6);
  expect(pixelAt(one).y).toBeCloseTo(pixelAt(zero).y / 2, 6);
});
