import type { GameFiles } from "../index";

export type Command = {
  id: string;
  action: string;
  params?: Record<string, unknown>;
};

// Written into the same folder the mod watches for reading; the mod polls
// for this file and reports back by writing a "commandResult" category,
// which the existing watcher picks up like any other PZDashboard_*.json.
export async function writeCommand(files: GameFiles, path: string, command: Command) {
  await files.write(path, JSON.stringify(command));
}
