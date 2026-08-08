import { join } from "node:path";
import { FILE_PREFIX, PZ_LUA_DIR } from "../config";

export type Command = {
  id: string;
  action: string;
  params?: Record<string, unknown>;
};

// Written into the same folder the mod watches for reading; the mod polls
// for this file and reports back by writing a "commandResult" category,
// which the existing watcher picks up like any other PZDashboard_*.json.
export async function writeCommand(command: Command) {
  const path = join(PZ_LUA_DIR, `${FILE_PREFIX}command.json`);
  await Bun.write(path, JSON.stringify(command));
}
