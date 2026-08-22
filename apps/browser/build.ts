import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dir;
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

async function build(args: string[]): Promise<void> {
  const child = Bun.spawn(["bun", "build", ...args], { cwd: root, stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) throw new Error(`Build failed: bun build ${args.join(" ")}`);
}

// The worker is built as a classic IIFE so it can be started from a Blob URL:
// a module worker built from a blob: cannot resolve its own static imports,
// and file:// refuses a worker script URL outright.
await build(["./watcher.worker.ts", "--outfile", "dist/watcher.worker.js", "--format", "iife", "--minify"]);
await build(["./index.html", "--outdir", "dist", "--minify"]);

const workerSource = readFileSync(join(dist, "watcher.worker.js"), "utf8");

// Everything is inlined into one HTML file. Served over http this changes
// nothing; from file:// it is the only shape that runs at all, because Chrome
// blocks external script and stylesheet fetches from an opaque origin.
const emitted = readdirSync(dist);
const script = emitted.find((name) => name.endsWith(".js") && name !== "watcher.worker.js");
const style = emitted.find((name) => name.endsWith(".css"));
if (!script) throw new Error("No bundled entry script found in dist/");

let html = readFileSync(join(dist, "index.html"), "utf8");

// Check the shell before anything is inlined - once a megabyte of bundled
// React is sitting in the document, scanning it for tags matches its own
// string literals. Anything relative that survives here would fail on file://.
const relative = html.match(/(?:src|href)="(?!https?:)[^"]*"/g) ?? [];
const expected = [`src="./${script}"`, ...(style ? [`href="./${style}"`] : [])];
const unexpected = relative.filter((ref) => !expected.includes(ref));
if (unexpected.length) throw new Error(`Cannot inline, would fail from file://: ${unexpected.join(", ")}`);

// A bundle that mentions "</script>" in any string literal would otherwise
// close its own tag and dump the rest of itself into the page as text.
// Inside JS, that sequence can only occur in a string or regex, where the
// escaped form parses identically.
function scriptBody(js: string): string {
  return js.replace(/<\/(script)/gi, "<\\/$1");
}

function inline(from: RegExp, to: string): void {
  const next = html.replace(from, () => to);
  if (next === html) throw new Error(`Nothing matched ${from} in index.html`);
  html = next;
}

if (style) inline(new RegExp(`<link[^>]*href="\\./${style}"[^>]*>`), `<style>${readFileSync(join(dist, style), "utf8")}</style>`);
inline(
  new RegExp(`<script[^>]*src="\\./${script}"[^>]*></script>`),
  `<script>globalThis.__PZ_WORKER_SRC = ${scriptBody(JSON.stringify(workerSource))};</script>\n<script type="module">${scriptBody(readFileSync(join(dist, script), "utf8"))}</script>`,
);

writeFileSync(join(dist, "index.html"), html);
for (const name of [script, style, "watcher.worker.js"].filter(Boolean) as string[]) rmSync(join(dist, name));

console.log(`\n  index.html  ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB  (single file, runs from file://)`);
