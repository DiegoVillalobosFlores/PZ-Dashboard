## Context

See `proposal.md` — Why. What shapes the approach is that the existing
`server/src/` is already almost entirely portable, and its coupling to the
frontend is already almost entirely centralised. Both facts were measured
rather than assumed.

Of ~2,200 lines outside `src/web/`, the pure-logic share is large:

| Module | Lines | Platform coupling |
|---|---|---|
| `model/xModel.ts` | 367 | none — text parse of `.x` meshes |
| `map/routing.ts` | 352 | none — operates on vectorMap output |
| `model/figure.ts` | 343 | none once mesh/texture loading is injected |
| `icons.ts` | 293 | `.pack` binary parse is pure; PNG codec is `node:zlib` |
| `map/vectorMap.ts` | 218 | one `readFileSync`, one XML parse |
| `map/tiles.ts` | 178 | `Bun.spawn(["unzip", …])` at `tiles.ts:52`, disk cache |
| `state/watcher.ts` | 114 | `readdir` poll every `PZ_POLL_MS` |
| `model/assets.ts` | 73 | case-insensitive path resolve over a real directory |
| `state/store.ts` | 30 | none — in-memory |
| `state/commands.ts` | 16 | one file write |

On the frontend side, `packages/web`'s entire knowledge of the server is
`src/web/lib/api.ts` (10 lines) and six call sites:

```
ItemIcon.tsx:29          /game-icons/:name
mapTiles.ts:12,24        /api/map/:region/:z/:x/:y   ·  /locate
vectorMap.ts:91,111      /api/map/:region/features   ·  /route
CharacterModel.tsx:274   /api/model/figure           (bare relative URL)
gameSocket.ts            /ws
```

Everything else — every screen, every transform, `equipment.ts`,
`containers.ts`, `skills.ts` — is already transport-agnostic, because
`useGameSubscription(key, onMessage)` hides the socket from components.

Three OpenSpec changes are in flight (`map-coordinate-readout`,
`map-time-weather-tint`, `container-loot-memory`) at 0 completed tasks each.
Nothing is half-written, but their task lists name `server/src/…` paths. This
change lands first, so those task lists must be re-pathed to `packages/core`
and `packages/web`.

## Goals / Non-Goals

**Goals:**

- One copy of every non-trivial algorithm, consumed by both apps.
- The browser app changes as little of `packages/web` as the chosen shape
  allows: the transport seam, plus the asynchronous asset URL seam the in-page
  fallback requires. No screen, transform or layout module changes.
- The restructure lands independently of whether the browser app's Service
  Worker approach works, so it is never blocked on an unproven capability.
- The server app's observable behaviour after the restructure is
  byte-identical: same routes, same WebSocket frames, same env vars, same
  `bun run compile` output.

**Non-Goals:**

- Feature parity between the two apps at launch. The browser app may ship
  with fewer working surfaces if a grant is refused; the specs define the
  degraded states rather than requiring all of them to work.
- A general-purpose filesystem abstraction. The port is exactly what the ten
  modules above need and nothing more.
- Build orchestration tooling. Bun workspaces only.

## Decisions

### Layout: two packages, two apps

```
packages/
  core/     framework-free logic + the platform port + the route table
  web/      the React app, moved verbatim from server/src/web/ + index.html
apps/
  server/   Bun.serve + node GameFiles + node codecs + compile targets
  browser/  static build + in-page route table + FSA GameFiles + browser codecs
mod/        unchanged
```

`core` and `web` are separate packages rather than one, because `core` must
stay importable from a Service Worker with no React in the graph.

Alternative considered: keep one `server/` package and add the browser app as
a sibling that imports from it. Rejected — `apps/browser` would then pull
`Bun.serve` and `node:fs` into its dependency graph, and the split between
portable and platform code would stay implicit rather than enforced by the
package boundary.

### One port, four methods

```ts
interface GameFiles {
  read(path: string): Promise<Uint8Array<ArrayBuffer>>;
  list(dir: string): Promise<string[]>;
  stat(path: string): Promise<{ mtimeMs: number } | null>;
  write(path: string, data: string | Uint8Array): Promise<void>;
}
```

Two roots are passed separately (the Zomboid data dir, read-write; the game
install dir, read-only) because they have no common ancestor on any platform.
`write` takes bytes as well as text: besides `PZDashboard_command.json` it is
how the extracted map tile pyramid reaches the cache, and routing PNG bytes
through a string would corrupt every tile.

Alternative considered: mirror `node:fs/promises` more completely, or model
streams. Rejected — nothing in the ten modules needs more than these four,
and every method added is a method the FSA adapter has to fake.

### Codecs injected as three functions, not an interface

`decodePng(bytes) → {width, height, rgba}`,
`encodePng({width, height, rgba}) → bytes` and
`inflateZip(bytes) → Map<name, bytes>` are the only capabilities that are
platform-shaped rather than I/O-shaped. They are passed as plain functions.

`encodePng` is the third because `renderIcon` does not just read atlases, it
answers `/game-icons/*` with a PNG it wrote itself; leaving the encoder in
`core` would have kept `node:zlib` in the shared package, which is the one
thing the split exists to prevent.

Node: the `node:zlib` PNG codec, moved out of `icons.ts` into
`apps/server/src/png.ts` unchanged, and `inflateRawSync` behind the zip
parser. Browser: `createImageBitmap` + an `OffscreenCanvas` `getImageData`,
`convertToBlob` for the encode, and `DecompressionStream('deflate-raw')`.

The zip *container* parse (end-of-central-directory scan, central directory
walk, local header offsets) is identical on both platforms, so it lives in
`packages/core/zip.ts` and takes the raw-deflate call as an argument. That
replaces the `unzip`/`tar` subprocess the server used to shell out to: a
subprocess cannot be reached from a browser, and `inflateZip(bytes)` has no
path to hand it. Verified byte-identical to `unzip` on all 1784 entries of
Muldraugh's pyramid. `listZip` reads the central directory without inflating
anything, which is what `/api/map/:region` needs and what `unzip -l` used to
provide.

The browser PNG path is markedly *shorter* than the server's — `icons.ts`
hand-rolls a decoder over `node:zlib` specifically to avoid an image
dependency in the single-file build, a constraint the browser does not have.
Sharing the decoder would mean shipping the long version to the platform that
needs the short one, so only the `.pack` index parse and the crop rectangle
maths move into `core`.

### The route table is the shared contract

`core` exports `makeRoutes(files, codecs, { installDir, cacheDir,
commandPath })` returning a handler that takes a `Request` and returns a
`Response`. The three paths are arguments rather than module-level config
because the browser app has no environment to read them from. Both hosts speak that dialect natively —
`Bun.serve` takes it directly, and a Service Worker `fetch` handler does
`event.respondWith(...)`.

This is what buys the "zero component changes" property. `<img
src="/game-icons/Axe.png">` and `fetch('/api/model/figure')` work unmodified
in the browser app because the worker is answering the same URL space the
server does. It also means `CharacterModel.tsx:274`'s bare relative URL —
today an inconsistency, since every other call site goes through `apiBase()`
— becomes correct rather than something to fix.

Alternative considered: have `packages/web` import `core` directly and call
functions instead of URLs in browser mode. Rejected — it forces every asset
consumer to become async and to hold `blob:` URLs, which `MapCanvas` would
feel worst, since it requests tiles continuously during pan.

### Live state: two transports behind the existing subscription

`gameSocket.ts` keeps its public surface (`useGameSubscription`,
`useServerConnection`, the per-category replay cache) and gains a transport
argument:

```
apps/server   →  WebSocket('/ws')                       unchanged
apps/browser  →  in-page watcher over GameFiles, same
                 {type:"state",category,data,updatedAt} frames
```

The browser watcher runs in a Web Worker, not on the main thread: the poll is
every `PZ_POLL_MS` (250ms default) across ~9 category files, and the main
thread is already easing the map marker on rAF.

The watcher deliberately keeps polling rather than trying to be clever. The
existing `state/watcher.ts` polls because `fs.watch` silently drops events
under the mod's write load; FSA has no change notification at all, so polling
is the only option there regardless.

### In-page route table, after the Service Worker spike could not run

The worker was the preferred host, but the spike is blocked in this checkout:
no real `.pack` asset and no granted game directory are available, so the
worker could never be made to serve a cropped icon request, and the capability
stays unverified rather than disproven.

`apps/browser` therefore ships the documented fallback: `browserRoutes()`
mounts `makeRoutes` in-page and assets resolve as `blob:` URLs behind
`packages/web/lib/assetUrl.ts`, consumed by `ItemIcon.tsx` and
`TraitsList.tsx`. `MapCanvas.tsx` and `CharacterModel.tsx` need no seam of
their own; they retry their asset requests when the browser grant changes.

The package boundary and the port are identical either way, which is why the
restructure was sequenced first and why moving to a worker later is a change
confined to `apps/browser`.

### Single-file build, because the Workshop ships files

The Workshop distributes the mod as files, so the browser app has to be a file
a subscriber opens - not a URL someone has to host. That means `file://`, and
`file://` is a stricter host than it looks. Measured in Chrome: it *is* a
secure context and `showDirectoryPicker` *is* available, so the grant flow
works unchanged. Three things do not:

- External `<script>` and `<link>` are blocked by CORS from origin `null`,
  which is why an ordinary `bun build` output renders a blank page.
- `new Worker("./watcher.worker.js")` throws `SecurityError`. A Blob-URL
  worker is allowed, so the worker bundle is inlined as a string and started
  from a Blob. It is built `--format iife` because a module worker created
  from a `blob:` URL cannot resolve its own static imports.
- `navigator.storage.getDirectory()` throws `SecurityError`, so there is no
  origin-private storage for the derived-asset cache.

`apps/browser/build.ts` therefore inlines the entry bundle, the stylesheet and
the worker into one `index.html`, and fails the build if any relative
reference survives. Inlined JS has `</script` escaped: the React bundle
contains that sequence in a string literal and would otherwise close its own
tag and spill the rest of itself into the page as text.

Losing origin-private storage costs less than it first appears. `cacheDir` is
only read by the raster tile pyramid and the decoded icon atlas pages, and the
frontend does not use raster tiles at all - the map is vector
(`/api/map/<region>/features`), and `tileUrl()` has no callers. So the
practical loss is re-decoding icon atlas pages once per session, not
re-extracting a 158 MB pyramid. `makeBrowserFiles` falls back to an in-memory
cache when no cache handle is available, which keeps `packages/core`
unchanged and unaware of the difference.

Alternative rejected: hosting the static page and shipping a link. It keeps
persistent storage and is one less build step, but it makes an offline,
no-download mode depend on someone maintaining a host, which is the opposite
of what the Workshop constraint asked for.

### Tooling: Bun workspaces, nothing else

Root `package.json` gains `"workspaces": ["packages/*", "apps/*"]`. No
Turborepo, no Nx, no changesets. Four packages, one lockfile, one `bun
install`. TypeScript path resolution goes through workspace deps rather than
`tsconfig` path aliases, so the compiled build and the type checker agree.

## Risks / Trade-offs

- **A Service Worker may not be able to use a `FileSystemDirectoryHandle`
  retrieved from IndexedDB under a grant the page issued.** Handles are
  structured-cloneable and workers can read IndexedDB, but permission prompts
  require a window and Chrome has had bugs in this area. → Settled by falling
  back: the spike could not be run here, so the in-page shape ships and the
  question is deferred to a later, `apps/browser`-only change.

- **`bun build --compile` may not resolve the HTML import across a workspace
  boundary.** `apps/server` imports `packages/web/index.html`, which today is
  a sibling file. → Settled: a throwaway two-package fixture resolved the HTML
  import, so `index.html` lives in `packages/web`.

- **The restructure invalidates paths in three in-flight changes.** All three
  are at 0 completed tasks, so no code conflicts — but their task lists name
  `server/src/…`. → Settled: this change lands first and those three task
  lists get re-pathed to `packages/core` / `packages/web`.

- **Two directory grants, no common ancestor.** The user sees two pickers on
  first run (`~/Zomboid` read-write, the install dir read-only). → Ask for
  them lazily: the data dir on first load, the install dir only when a screen
  needs game assets, so the dashboard shows live vitals before the second
  prompt appears.

- **The browser app is Chromium-desktop only, forever.** Firefox has declined
  `showDirectoryPicker`; Safari does not implement it; no mobile browser does.
  → This is inherent, not a defect. The specs state it as a constraint and the
  app detects it and says so rather than failing obscurely. Anyone who needs
  another browser or another device uses the server app, which is why both
  exist.

- **Two apps is two things to keep working.** The shared route table and the
  shared core are what keep the cost sublinear, but CI has to build and
  typecheck both or they will drift. → Both apps build in the same CI job from
  the same commit.

- **Refactor churn with no user-visible payoff.** Roughly 3,800 lines move.
  → The server app's behaviour is unchanged by construction, and the existing
  `icons.test.ts`, `fog.test.ts` and `traits.test.ts` move with their modules
  and must pass before and after.

## Migration Plan

1. Spike the Service Worker + FSA question. Outcome recorded here; nothing
   else depends on it.
2. Introduce the workspace root and move `server/src/web/` → `packages/web`
   with no edits, keeping `server/` working. Verify the app still runs.
3. Move the ten logic modules into `packages/core`, converting `node:fs` and
   `Bun.spawn` calls to the port as each moves. One module per commit, tests
   green at each step.
4. Reduce `server/` to `apps/server`: config, the node adapters, `Bun.serve`
   mounting `makeRoutes`, and the compile scripts.
5. Add the `gameSocket.ts` transport argument, with the WebSocket transport as
   the default so the server app is unaffected.
6. Build `apps/browser` on the shape the spike chose.
7. Update `CLAUDE.md`, `AGENTS.md`, `README.md`, `.zed/rules.md`,
   `scripts/deploy-mod.ts` and `.claude/skills/pz-mod-server/SKILL.md` to the
   new paths.

Rollback is `git revert` of the restructure commits; the mod's JSON contract
is untouched throughout, so a reverted server keeps working against a live
game with no mod redeployment.

## Open Questions

- Settled: `apps/browser` is not hosted. It builds to a single self-contained
  `index.html` that ships inside the mod and runs from `file://`. Serving that
  same file over HTTP still works and gains persistent asset caching.
- Does the browser app persist its handles per-origin only, or offer an
  explicit "forget these folders" control? A privacy nicety, decidable after
  the grant flow exists.
