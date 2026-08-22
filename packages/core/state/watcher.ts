import type { GameFiles } from "../index";
import { FILE_PREFIX, POLL_INTERVAL_MS } from "../config";
import { joinPath } from "../path";
import { setCategory } from "./store";

export type SnapshotUpdate = {
  category: string;
  data: unknown;
  updatedAt: number;
};

export type WatcherOptions = {
  pollIntervalMs?: number;
  onUpdate?: (update: SnapshotUpdate) => void;
};

export type SnapshotWatcher = {
  stop(): void;
  poll(): Promise<void>;
};

function categoryFromFilename(filename: string): string | null {
  if (!filename.startsWith(FILE_PREFIX) || !filename.endsWith(".json")) return null;
  return filename.slice(FILE_PREFIX.length, -".json".length);
}

export async function startWatcher(files: GameFiles, dataDir: string, options: WatcherOptions = {}): Promise<SnapshotWatcher> {
  const loadedMtimes = new Map<string, number>();
  const inFlight = new Set<string>();
  let stopped = false;
  let polling = false;

  async function loadFile(filename: string, mtimeMs: number) {
    const category = categoryFromFilename(filename);
    if (!category || inFlight.has(filename) || stopped) return;
    inFlight.add(filename);
    try {
      const data = JSON.parse(new TextDecoder().decode(await files.read(joinPath(dataDir, filename))));
      setCategory(category, data, mtimeMs);
      options.onUpdate?.({ category, data, updatedAt: mtimeMs });
      loadedMtimes.set(filename, mtimeMs);
    } catch {
    } finally {
      inFlight.delete(filename);
    }
  }

  async function loadIfChanged(filename: string) {
    if (!categoryFromFilename(filename) || stopped) return;
    const fileStat = await files.stat(joinPath(dataDir, filename)).catch(() => null);
    if (!fileStat || loadedMtimes.get(filename) === fileStat.mtimeMs) return;
    await loadFile(filename, fileStat.mtimeMs);
  }

  async function poll() {
    if (stopped || polling) return;
    polling = true;
    try {
      const entries = await files.list(dataDir).catch(() => []);
      await Promise.all(entries.map(loadIfChanged));
    } finally {
      polling = false;
    }
  }

  await poll();
  const interval = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const timer = setInterval(() => void poll(), interval);

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    poll,
  };
}
