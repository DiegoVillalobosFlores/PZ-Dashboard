import { homedir } from "node:os";
import { join } from "node:path";

export const PZ_LUA_DIR = process.env.PZ_LUA_DIR || join(homedir(), "Zomboid", "Lua");
export const FILE_PREFIX = "PZDashboard_";
export const PORT = Number(process.env.PORT) || 3000;

// How often the watcher rescans PZ_LUA_DIR for changed snapshots. This poll -
// not fs.watch - is what actually guarantees the dashboard stays live; see
// the comment in state/watcher.ts. Wants to be at or below the mod's fastest
// category interval (0.5s for "map") so nothing is rendered a beat late.
export const POLL_INTERVAL_MS = Number(process.env.PZ_POLL_MS) || 250;

// The Project Zomboid game install (not the Zomboid data dir) - where
// media/maps/<Region>/spawnSelectImagePyramid.zip lives. No sane default
// exists across native/Proton/Windows installs, same as PZ_LUA_DIR.
export const PZ_INSTALL_DIR = process.env.PZ_INSTALL_DIR || "";
export const MAP_CACHE_DIR = join(import.meta.dir, "..", ".cache", "maps");
