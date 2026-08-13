import { expect, test } from "bun:test";
import { PZ_INSTALL_DIR } from "./config";
import { renderIcon } from "./icons";

test.skipIf(!PZ_INSTALL_DIR)("crops a known item icon out of the game's texture packs", () => {
  const png = renderIcon("Item_Radish");
  expect(png).not.toBeNull();

  const signature = png!.subarray(0, 8);
  expect([...signature]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(png!.toString("latin1", 12, 16)).toBe("IHDR");

  const width = png!.readUInt32BE(16);
  const height = png!.readUInt32BE(20);
  expect(width).toBe(31);
  expect(height).toBe(31);
  expect(png!.length).toBeLessThan(4096);
});

test.skipIf(!PZ_INSTALL_DIR)("returns null for a texture that isn't in any pack", () => {
  expect(renderIcon("Item_ThisDoesNotExist")).toBeNull();
});
