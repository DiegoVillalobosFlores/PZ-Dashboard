import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const COMPILED = /\$bunfs|~BUN/.test(import.meta.dir);
export const APP_DIR = COMPILED ? dirname(process.execPath) : join(import.meta.dir, "..");

if (COMPILED) {
  const envFile = join(APP_DIR, ".env");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      if (/^\s*(#|$)/.test(line)) continue;
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue = ""] = match;
      process.env[key!] ??= rawValue.replace(/^(["'])(.*)\1$/, "$2");
    }
  }
}

export const PZ_LUA_DIR = process.env.PZ_LUA_DIR || join(homedir(), "Zomboid", "Lua");
export const FILE_PREFIX = "PZDashboard_";
export const PORT = Number(process.env.PORT) || 3000;

// How often the watcher rescans PZ_LUA_DIR for changed snapshots. This poll -
// not fs.watch - is what actually guarantees the dashboard stays live; see
// the comment in state/watcher.ts. Wants to be at or below the mod's fastest
// category interval (0.1s for "map" while the player is in a vehicle, 0.25s
// on foot) so nothing is rendered a beat late.
export const POLL_INTERVAL_MS = Number(process.env.PZ_POLL_MS) || 100;

// The Project Zomboid game install (not the Zomboid data dir) - where
// media/maps/<Region>/spawnSelectImagePyramid.zip lives. No sane default
// exists across native/Proton/Windows installs, same as PZ_LUA_DIR.
export const PZ_INSTALL_DIR = process.env.PZ_INSTALL_DIR || "";
export const MAP_CACHE_DIR = process.env.PZ_CACHE_DIR || join(APP_DIR, ".cache", "maps");
