## Why

Publishing the mod to the Steam Workshop forces a distribution question the
current layout cannot answer twice. The Workshop ships files, never a process,
and the PZ Lua sandbox cannot spawn one — so a subscriber has to start the
companion server themselves. Two answers exist and neither dominates:

- **Server app** (today's `server/`): a compiled Bun binary. Serves any
  browser on the LAN, which is the whole point of a second-screen dashboard —
  phone, tablet, Ayaneo handheld. Costs an unsigned-binary download, a
  SmartScreen warning, a firewall prompt, and two paths to configure.
- **Browser app** (new): a static page that reads the game's files directly
  through the File System Access API. No download, no binary, no firewall,
  and the directory picker replaces path detection entirely — it is correct
  for native, Proton, and Game Pass installs without probing anything. Costs
  Chromium-only support and only works on the machine running the game, so it
  serves a second *monitor*, not a second *device*.

They serve different users and both are worth having. What is not worth having
is two copies of the `.pack` atlas decoder, the `.x` mesh parser, the map
routing graph and the React app. Today all of that lives inside one Bun
process at `server/src/`, entangled with `node:fs` and `Bun.spawn`, so a
second app cannot reuse any of it.

## What Changes

- **BREAKING** (developer-facing only, no runtime behaviour change):
  restructure the repository into a Bun workspace monorepo. `server/src/`
  splits into `packages/core` (framework-free logic, zero I/O) and
  `packages/web` (the React app, moved verbatim from `server/src/web/`).
  `server/` becomes `apps/server`. Existing paths in `CLAUDE.md`,
  `AGENTS.md`, `README.md`, `.zed/rules.md` and `scripts/deploy-mod.ts`
  are updated to match.
- Introduce a single `GameFiles` port — `read`, `list`, `stat`, `write` — plus
  three injected codec functions (`decodePng`, `encodePng`, `inflateZip`)
  covering the only capabilities that are genuinely platform-shaped rather
  than I/O-shaped.
  Every module that currently calls `node:fs` or `Bun.spawn` takes these as
  arguments instead.
- `packages/core` exports the HTTP route table as handler functions returning
  standard `Response` objects, so both apps mount the same contract rather
  than reimplementing it. `apps/server` mounts it on `Bun.serve`;
  `apps/browser` mounts it in-page.
- Add `apps/browser`: a static build of `packages/web` that mounts the shared
  route table in-page and answers `/api/*` and `/game-icons/*` from File System
  Access handles. Because the same URL space is answered locally, every screen
  and transform is untouched; the one cost of the in-page shape is that asset
  URLs become asynchronous.
- Generalise the live-state transport in `packages/web/lib/gameSocket.ts` so
  it accepts either the existing `/ws` WebSocket (server app) or an in-page
  file watcher (browser app). This and the asynchronous asset URL seam in
  `lib/assetUrl.ts` (consumed by `ItemIcon.tsx` and `TraitsList.tsx`) are the
  two deliberate edits inside the web package.
- Both apps ship from the same commit and the same `packages/core`, so the
  JSON contract with the mod cannot drift between them.

Explicitly **not** in scope: the Steam Workshop publishing pipeline, the
mod-side heartbeat file and in-game connection panel, and zero-config path
detection for the server app. Those are separate changes that this one
unblocks by making a second app possible at all.

## Capabilities

### New Capabilities

- `browser-direct-mode`: the dashboard running with no server process, reading
  the game's snapshot files and install assets directly from the local disk
  through user-granted File System Access handles, and writing the mod's
  command file back. Covers the grant flow and its persistence, the degraded
  states when a grant is missing or refused, parity with the server app's URL
  contract, and the explicit non-goal of remote/second-device access.

### Modified Capabilities

None. The monorepo restructure is a pure refactor: the server app's observable
behaviour — routes, WebSocket protocol, env vars, compiled output — is
unchanged, so no existing requirement changes.

## Impact

- **Moved**: all of `server/src/` (~3,800 lines including the frontend).
  `server/src/web/` → `packages/web`; `icons.ts`, `map/`, `model/`, `state/`
  → `packages/core`; `index.ts`, `config.ts` → `apps/server`.
- **Rewritten against the port, not reimplemented**: `map/tiles.ts` (drops
  `Bun.spawn(["unzip", …])` for the shared `packages/core/zip.ts` container
  parser, which takes the raw-deflate call as an argument), `map/vectorMap.ts` (`readFileSync` → port),
  `icons.ts` (splits: `.pack` index parse is shared, PNG codec is injected),
  `model/assets.ts` (case-insensitive resolve now builds an index from
  `list()`), `state/watcher.ts` and `state/commands.ts`.
- **Untouched**: `mod/` and its JSON contract. Every component and screen in
  the web package. `docs/`, `penpot/`.
- **New dependency surface**: none added. The browser app uses
  `DecompressionStream`, `createImageBitmap`, OPFS and IndexedDB, all
  platform-native.
- **Build**: root `package.json` gains `workspaces`. `bun run compile` and
  `compile:all` move to `apps/server` and keep their current behaviour;
  `apps/browser` gains a static `bun build` target suitable for any static
  host.
- **Risk, resolved**: the Service Worker approach depended on a worker being
  able to use a `FileSystemDirectoryHandle` retrieved from IndexedDB under a
  grant issued by the page. The spike could not run in this checkout, so the
  browser app ships the documented in-page fallback instead (see `design.md`).
  The monorepo restructure never depended on the outcome.
