## 1. De-risk before moving anything

- [x] 1.1 Spike: register a Service Worker, stash a `FileSystemDirectoryHandle` in IndexedDB from the page, grant read, and have the worker serve one `/game-icons/*` request cropped out of a real `.pack` file. Record the outcome in `design.md` under Decisions.
- [x] 1.2 If 1.1 fails, record the in-page `blob:` URL fallback as the chosen shape and note which `packages/web` call sites need an async URL seam.
- [x] 1.3 Verify `bun build --compile` resolves an HTML import across a workspace boundary with a throwaway two-package fixture. If it does not, record that `index.html` stays in `apps/server`.
- [x] 1.4 Decide ordering against the three in-flight changes (`map-coordinate-readout`, `map-time-weather-tint`, `container-loot-memory`) and re-path their task lists if this change lands first.

## 2. Workspace root

- [x] 2.1 Add `"workspaces": ["packages/*", "apps/*"]` to the root `package.json` and create the four empty package manifests.
- [x] 2.2 Move `server/src/web/` and `server/index.html` to `packages/web/` with no content edits; point `server/src/index.ts` at the new location and confirm `bun run dev` still serves the dashboard.
- [x] 2.3 Move `server/src/web/lib/fog.test.ts` and `traits.test.ts` with their modules and confirm they still pass.

## 3. The platform port

- [x] 3.1 Define `GameFiles` (`read`, `list`, `stat`, `write`) and the three `Codecs` functions (`decodePng`, `encodePng`, `inflateZip`) in `packages/core`.
- [x] 3.2 Implement the node adapter in `apps/server` over `node:fs/promises`, moving the existing `node:zlib` PNG codec out of core into `src/png.ts` unchanged and inflating the tile pyramid with `inflateRawSync` behind the shared zip parser (the `unzip`/`tar` subprocess cannot be expressed as `inflateZip(bytes)`, and a browser has no subprocess).
- [x] 3.3 Assert the two roots (data dir read-write, install dir read-only) are separate arguments, not one filesystem.

## 4. Move logic into core, one module per commit

- [x] 4.1 `state/store.ts` — no platform coupling, move as-is.
- [x] 4.2 `model/xModel.ts` — no platform coupling, move as-is; confirm a real `.x` mesh still parses.
- [x] 4.3 `map/routing.ts` — no platform coupling, move as-is.
- [x] 4.4 `map/vectorMap.ts` — replace `readFileSync` with the port.
- [x] 4.5 `model/assets.ts` — replace the case-insensitive resolve with an index built once from `list()`.
- [x] 4.6 `model/figure.ts` — take mesh and texture loading through the port; confirm the T-pose figure, the `Bip01_Dress*` cull and the covered-triangle removal are unchanged.
- [x] 4.7 `icons.ts` — split the `.pack` index parse and crop maths into core, leave PNG decode to the injected codec; `icons.test.ts` moves with it and must pass.
- [x] 4.8 `map/tiles.ts` — route the pyramid extraction through `inflateZip` and the cache through the port; keep the coordinate transform and the extraction marker behaviour identical.
- [x] 4.9 `state/watcher.ts` — poll through the port at `PZ_POLL_MS`; keep polling, do not substitute a change-notification API.
- [x] 4.10 `state/commands.ts` — write through the port.

## 5. Shared route table

- [x] 5.1 Export `makeRoutes(files, codecs, { installDir, cacheDir, commandPath })` from `packages/core` returning a `Request → Response` handler for every path in `server/src/index.ts`: `/api/state`, `/api/state/:category`, `/api/action`, `/api/model/*`, `/api/map/*`, `/game-icons/:name`.
- [x] 5.2 Reduce `server/` to `apps/server`: config, node adapters, `Bun.serve` mounting `makeRoutes`, the `/ws` upgrade, and the SPA fallback.
- [x] 5.3 Move `compile` and `compile:all` to `apps/server` and confirm the single-file binary still bundles the frontend and runs from `dist/`.
- [x] 5.4 Diff the running server against `master` route by route — same status codes, same content types, same WebSocket frames — before considering the restructure done.

## 6. Transport seam in the web package

- [x] 6.1 Give `gameSocket.ts` a transport argument, defaulting to the existing `/ws` WebSocket so the server app is unaffected.
- [x] 6.2 Keep `useGameSubscription`, `useServerConnection`, the per-key ref-counting and the per-category replay cache unchanged in behaviour.
- [x] 6.3 Confirm the server app still recovers from a dropped socket and still replays the last snapshot per category on late subscribe.

## 7. Browser app

- [x] 7.1 Scaffold `apps/browser` as a static `bun build` of `packages/web` plus the shape chosen in 1.1/1.2.
- [x] 7.2 Capability and secure-context detection with the unsupported-browser notice, before any picker is shown.
- [x] 7.3 FSA adapter implementing `GameFiles` against two directory handles.
- [x] 7.4 Browser codecs: `createImageBitmap` + `OffscreenCanvas` for PNG, zip central-directory parse + `DecompressionStream('deflate-raw')` for the tile pyramid.
- [x] 7.5 Grant flow: data directory on first load, install directory lazily on first asset need, with the wrong-directory recovery path.
- [x] 7.6 Persist handles in IndexedDB and restore them; re-confirm access without re-picking when the permission has lapsed.
- [x] 7.7 Mount `makeRoutes` so `/api/*` and `/game-icons/*` resolve locally; use the documented asynchronous asset URL seam required by the in-page fallback.
- [x] 7.8 Run the file watcher in a Web Worker and feed the transport from 6.1.
- [x] 7.9 Command writes into the data directory, with actions disabled and explained when the grant is read-only.
- [x] 7.10 Cache extracted tiles and decoded atlas pages in OPFS; handle a first-extraction-in-progress state and recover from eviction.
- [x] 7.11 State the local-only limit where a user would look for phone access, pointing at the server app.

## 8. Verify against the specs

- [x] 8.1 Walk every scenario in `specs/browser-direct-mode/spec.md` against the running browser app, including the refusal and lapsed-permission paths.
- [x] 8.2 Run both apps against the same live game and confirm identical rendering on every screen.
- [x] 8.3 Confirm no game file contents leave the origin in the browser app.

## 8b. Ship as one file the mod can carry

- [x] 8b.1 Inline the entry bundle, stylesheet and worker into a single `index.html`, failing the build on any surviving relative reference.
- [x] 8b.2 Start the watcher from a Blob URL, since `file://` refuses a worker script URL; build the worker as IIFE so a blob module has no imports to resolve.
- [x] 8b.3 Escape `</script` in inlined JS so the React bundle cannot close its own tag.
- [x] 8b.4 Fall back to a per-session memory cache when the origin has no private file system.
- [x] 8b.5 Make `apiBase()` relative so URLs do not depend on how a host spells its origin.
- [x] 8b.6 Confirm the single file boots from `file://` and the server app is unregressed.
- [x] 8b.7 Validate the data directory grant the way the install grant is validated, naming the install-directory mix-up and accepting a Lua folder the mod has not written to yet.

## 9. Documentation and paths

- [x] 9.1 Update `CLAUDE.md`, `AGENTS.md`, `.zed/rules.md` and `.claude/skills/pz-mod-server/SKILL.md` to the new layout.
- [x] 9.2 Update root `README.md` and split `server/README.md` into `apps/server` and `apps/browser` readmes.
- [x] 9.3 Update `scripts/deploy-mod.ts` and any `server/.env.local` references.
- [x] 9.4 Add a CI job that builds and typechecks both apps from the same commit.
