import { expect, test } from "bun:test";
import type { Codecs, GameFiles } from "./index";
import { makeRoutes } from "./routes";

function memoryFiles(): GameFiles & { store: Map<string, Uint8Array<ArrayBuffer>> } {
  const store = new Map<string, Uint8Array<ArrayBuffer>>();
  return {
    store,
    async read(path) {
      const value = store.get(path);
      if (!value) throw new Error(`ENOENT ${path}`);
      return value;
    },
    async list() {
      return [];
    },
    async stat(path) {
      return store.has(path) ? { mtimeMs: 0 } : null;
    },
    async write(path, content) {
      store.set(path, typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content));
    },
  };
}

const codecs = {
  decodePng: () => {
    throw new Error("unused");
  },
  encodePng: () => {
    throw new Error("unused");
  },
  inflateZip: () => new Map(),
} as unknown as Codecs;

test("serves map tiles with immutable cache headers", async () => {
  const files = memoryFiles();
  files.store.set("/cache-route/KY/.extracted", new Uint8Array());
  files.store.set("/cache-route/KY/3/tile1x1.png", new Uint8Array([1, 2, 3]));
  const routes = makeRoutes(files, codecs, { installDir: "/install", cacheDir: "/cache-route", commandPath: "/command" });

  const response = await routes(new Request("http://localhost/api/map/KY/3/1/1"));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
});
