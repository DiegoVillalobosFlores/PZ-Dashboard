import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { join } from "node:path";
import { FILE_PREFIX, POLL_INTERVAL_MS, PZ_LUA_DIR } from "../config";
import { setCategory } from "./store";

// mtime of the last snapshot successfully parsed out of each file. Only
// written on success, so a torn read (the mod truncates and rewrites each
// file in place, so a read can land mid-write and see a truncated buffer)
// leaves the entry alone and the next poll retries that file rather than
// dropping the update forever.
const loadedMtimes = new Map<string, number>();
// Guards against the fs.watch callback and the poll both loading the same
// file at once and publishing the same snapshot twice.
const inFlight = new Set<string>();

function categoryFromFilename(filename: string): string | null {
  if (!filename.startsWith(FILE_PREFIX) || !filename.endsWith(".json")) return null;
  return filename.slice(FILE_PREFIX.length, -".json".length);
}

// `mtimeMs` must be sampled *before* the read: if the mod rewrites the file
// in between, we record the older stamp against newer content, the next poll
// sees a mismatch and reloads. Sampling after the read could record a stamp
// newer than what we actually parsed and strand a stale snapshot.
async function loadFile(filename: string, mtimeMs: number) {
  const category = categoryFromFilename(filename);
  if (!category || inFlight.has(filename)) return;
  inFlight.add(filename);

  try {
    const raw = await readFile(join(PZ_LUA_DIR, filename), "utf8");
    setCategory(category, JSON.parse(raw), mtimeMs);
    loadedMtimes.set(filename, mtimeMs);
  } catch {
    // File vanished, or the mod was mid-write and we got a partial buffer.
    // loadedMtimes is deliberately left untouched so the next poll retries.
  } finally {
    inFlight.delete(filename);
  }
}

async function loadIfChanged(filename: string) {
  if (!categoryFromFilename(filename)) return;
  let mtimeMs: number;
  try {
    ({ mtimeMs } = await stat(join(PZ_LUA_DIR, filename)));
  } catch {
    return;
  }
  if (loadedMtimes.get(filename) === mtimeMs) return;
  await loadFile(filename, mtimeMs);
}

async function pollOnce() {
  let entries: string[];
  try {
    entries = await readdir(PZ_LUA_DIR);
  } catch {
    // Directory disappeared (game uninstalled/prefix remounted) - the next
    // tick will find it again if it comes back.
    return;
  }
  await Promise.all(entries.map(loadIfChanged));
}

async function waitForLuaDir() {
  while (!existsSync(PZ_LUA_DIR)) {
    console.warn(
      `[watcher] waiting for ${PZ_LUA_DIR} to exist — start Project Zomboid with the PZDashboard mod enabled`,
    );
    await Bun.sleep(5000)
  }
}

// `bun --hot` re-evaluates this module without tearing down timers started by
// the previous copy, so without this every reload would leave another poller
// running. globalThis survives the reload; module-level state does not.
declare global {
  var pzDashboardPollTimer: ReturnType<typeof setInterval> | undefined;
}

export async function startWatcher() {
  await waitForLuaDir();

  await pollOnce();

  // fs.watch is not reliable for this workload and must not be the only
  // source of updates: the mod rewrites ~8 files a second in place, and under
  // that load most inotify events never surface. Observed in practice - the
  // dashboard sat on an 11-minute-old position snapshot while the JSON on
  // disk was current, with some categories updating and others frozen. The
  // interval below is what actually guarantees liveness; the watch is kept
  // purely to shave latency off the events it does happen to deliver. Both
  // paths funnel through loadIfChanged's mtime check, so a duplicate is a
  // no-op rather than a repeated publish.
  try {
    watch(PZ_LUA_DIR, (_event, filename) => {
      // fs.watch doesn't reliably report a filename on every platform/event
      // (documented Node limitation) - fall back to a full rescan, which is
      // cheap here (a handful of small JSON files).
      if (filename) void loadIfChanged(String(filename));
      else void pollOnce();
    });
  } catch (err) {
    console.warn(`[watcher] fs.watch unavailable, polling only: ${err}`);
  }

  clearInterval(globalThis.pzDashboardPollTimer);
  globalThis.pzDashboardPollTimer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);

  console.log(`[watcher] watching ${PZ_LUA_DIR} for PZDashboard snapshots (poll ${POLL_INTERVAL_MS}ms)`);
}
