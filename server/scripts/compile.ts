import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");

const TARGETS: Record<string, string> = {
  "bun-linux-x64": "pz-dashboard-linux-x64",
  "bun-windows-x64": "pz-dashboard-windows-x64.exe",
  "bun-darwin-arm64": "pz-dashboard-macos-arm64",
};

const hostName = process.platform === "win32" ? "pz-dashboard.exe" : "pz-dashboard";
const targets: [string | null, string][] = process.argv.includes("--all")
  ? Object.entries(TARGETS)
  : [[null, hostName]];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const failed: string[] = [];

for (const [target, name] of targets) {
  const outfile = join(DIST, name);
  const args = ["bun", "build", "--compile", "--minify", join(ROOT, "src/index.ts"), "--outfile", outfile];
  if (target) args.push(`--target=${target}`);

  const proc = Bun.spawn(args, { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) failed.push(target ?? "host");
}

if (failed.length === targets.length) {
  console.error(`[compile] every target failed (${failed.join(", ")})`);
  process.exit(1);
}
if (failed.length) {
  console.warn(
    `[compile] skipped ${failed.join(", ")} - cross-target runtimes are only downloadable for released Bun versions, not canaries (${Bun.version})`,
  );
}

cpSync(join(ROOT, ".env.example"), join(DIST, ".env.example"));

console.log(`[compile] wrote ${DIST}`);
