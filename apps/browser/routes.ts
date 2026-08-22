import { makeRoutes } from "../../packages/core/routes";
import type { Codecs, GameFiles } from "../../packages/core";

export function browserRoutes(files: GameFiles, codecs: Codecs) {
  return makeRoutes(files, codecs, { installDir: "/install", cacheDir: "/cache/maps", commandPath: "/data/PZDashboard_command.json" });
}
