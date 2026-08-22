import { expect, test } from "bun:test";
import { PZ_INSTALL_DIR } from "./config";
import { renderIcon } from "./icons";
import { makeNodeFiles, nodeCodecs } from "../../apps/server/src/files";

test.skipIf(!PZ_INSTALL_DIR)("crops a known item icon out of the game's texture packs", async () => {
  const png = await renderIcon(makeNodeFiles(), nodeCodecs, PZ_INSTALL_DIR, "Item_Radish");
  expect(png).not.toBeNull();

  const view = new DataView(png!.buffer, png!.byteOffset, png!.byteLength);
  expect([...png!.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(String.fromCharCode(...png!.subarray(12, 16))).toBe("IHDR");

  expect(view.getUint32(16)).toBe(31);
  expect(view.getUint32(20)).toBe(31);
  expect(png!.length).toBeLessThan(4096);
});

test.skipIf(!PZ_INSTALL_DIR)("returns null for a texture that isn't in any pack", async () => {
  expect(await renderIcon(makeNodeFiles(), nodeCodecs, PZ_INSTALL_DIR, "Item_ThisDoesNotExist")).toBeNull();
});
