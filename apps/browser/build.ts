import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dir;
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const builds = [
  ["bun", "build", "./index.html", "--outdir", "dist", "--minify"],
  ["bun", "build", "./watcher.worker.ts", "--outfile", "dist/watcher.worker.js", "--minify"],
];

for (const args of builds) {
  const process = Bun.spawn(args, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if ((await process.exited) !== 0) throw new Error(`Build failed: ${args.join(" ")}`);
}
