import { expect, test } from "bun:test";
import { validateData } from "./grants";
import type { DirectoryHandle } from "./files";

function handle(name: string, entries: Record<string, "file" | "directory">): DirectoryHandle {
  return {
    name,
    async *entries() {
      for (const [child, kind] of Object.entries(entries)) yield [child, { kind }];
    },
  } as unknown as DirectoryHandle;
}

test("accepts a Lua directory the mod has already written to", async () => {
  const dir = handle("Lua", { "PZDashboard_status.json": "file", "layout.ini": "file" });
  expect(await validateData(dir)).toBeNull();
});

test("accepts a Zomboid data directory before the mod has ever run", async () => {
  const dir = handle("Lua", { "layout.ini": "file", "keysB42.ini": "file" });
  expect(await validateData(dir)).toBeNull();
});

test("names the mix-up when given the game install directory", async () => {
  const dir = handle("ProjectZomboid", { media: "directory", "ProjectZomboid64.exe": "file" });
  const message = await validateData(dir);
  expect(message).toContain("looks like the game install directory");
  expect(message).toContain("asked for separately");
});

test("rejects an unrelated directory and says what it looked for", async () => {
  const dir = handle("Documents", { "notes.txt": "file" });
  const message = await validateData(dir);
  expect(message).toContain("PZDashboard_*.json");
  expect(message).toContain("Documents");
});

test("reports a directory it cannot read", async () => {
  const dir = {
    name: "Denied",
    entries() {
      throw new Error("nope");
    },
  } as unknown as DirectoryHandle;
  expect(await validateData(dir)).toBe('Could not read "Denied".');
});
