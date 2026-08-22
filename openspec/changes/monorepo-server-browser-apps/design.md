## Context

## Decisions

The Service Worker/File System Access spike is blocked in this checkout: no
real `.pack` asset or granted game directory is available, so the worker could
not serve a cropped icon request. The browser implementation uses the planned
in-page fallback shape, with asynchronous asset URL access.

The throwaway `bun build --compile` fixture resolved an HTML import across a
workspace boundary successfully. `index.html` can live in `packages/web`.

This change lands before `map-coordinate-readout`, `map-time-weather-tint`, and
`container-loot-memory`; their task lists must use `packages/core` and
`packages/web` paths after the move.

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
Nothing is half-written, but their task lists name `server/src/…` paths.

## Goals / Non-Goals

**Goals:**

- One copy of every non-trivial algorithm, consumed by both apps.
- The browser app requires zero changes to any component in `packages/web`.
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
  browser/  static build + Service Worker + FSA GameFiles + browser codecs
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

### Service Worker, with a documented fallback

The worker is the preferred host for the route table, but it rests on an
unverified capability (see Risks). If the spike fails, `apps/browser` falls
back to resolving assets in-page as `blob:` URLs behind a small
`useAssetUrl()` hook, and `packages/web` gains that one extra seam. The
package boundary and the port do not change either way, which is why the
restructure is sequenced first.

### Tooling: Bun workspaces, nothing else

Root `package.json` gains `"workspaces": ["packages/*", "apps/*"]`. No
Turborepo, no Nx, no changesets. Four packages, one lockfile, one `bun
install`. TypeScript path resolution goes through workspace deps rather than
`tsconfig` path aliases, so the compiled build and the type checker agree.

## Risks / Trade-offs

- **A Service Worker may not be able to use a `FileSystemDirectoryHandle`
  retrieved from IndexedDB under a grant the page issued.** Handles are
  structured-cloneable and workers can read IndexedDB, but permission prompts
  require a window and Chrome has had bugs in this area. → Spike it first, as
  the first task: register a worker, stash a handle from the page, grant read,
  serve exactly one `/game-icons/*` request from a `.pack`. Under a day, and
  it decides the browser app's shape without touching the restructure.

- **`bun build --compile` may not resolve the HTML import across a workspace
  boundary.** `apps/server` imports `packages/web/index.html`, which today is
  a sibling file. → Verify with a throwaway compile before the move is
  finalised; if it fails, `index.html` stays in `apps/server` and imports the
  web package's entry module instead.

- **The restructure invalidates paths in three in-flight changes.** All three
  are at 0 completed tasks, so no code conflicts — but their task lists name
  `server/src/…`. → Land this change first and re-path those task lists, or
  land them first and rebase this one. Deciding order is cheaper than merging.

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

- Where does `apps/browser` get hosted — GitHub Pages off this repo, or
  bundled into the server app's static output so the server can serve it too?
  Both work; it does not change the code.
- Does the browser app persist its handles per-origin only, or offer an
  explicit "forget these folders" control? A privacy nicety, decidable after
  the grant flow exists.
