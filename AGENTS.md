# PZ Dashboard

A companion, browser-based interface for a Project Zomboid mod: the mod
streams live game state (status, map, inventory, skills, toolbar) to a local
server, and this is the second-screen UI that displays and acts on it. See
`PRODUCT.md` for full product context.

Don't write any code comments this is the most important rule you need to follow

## Working efficiently

Context is re-sent on every turn, so anything pulled in early is paid for
again on every later call. A transcript audit of this project found the
cost is almost entirely tool output — `Read` results (23%), `Bash` results
(16%), and Chrome DevTools snapshots + screenshots (22% combined). The
rules below target those.

- **Read narrowly.** Prefer `offset`/`limit` or `Grep` over reading a whole
  file when you know what you're after. `MapCanvas.tsx`,
  `PZDashboard_Collectors.lua` and `penpot/helpers.js` are the big ones —
  don't pull them in whole to check one function. Never re-read a file you
  already read or just edited; `Edit`/`Write` fail loudly if they didn't
  apply, so re-reading to "verify" only buys context.
- **Filter in the shell, not in context.** Pipe through `jq`, `rg`, `bun -e`
  and print the fields you need. Don't dump a whole state JSON, mod
  `console.txt`, or a Penpot board export and read it back — especially
  don't round-trip via `/tmp/*.json`, which was the single most expensive
  read pattern measured.
- **Screenshot scoped.** `resize_page` to the layout you're testing (mobile
  390x844 or Ayaneo 1620x1080) before capturing, or pass a `uid` to grab one
  element. A bare `take_screenshot` at the default viewport costs ~1.2k
  tokens and stays in context for the rest of the session. Don't pair
  `take_snapshot` with `take_screenshot` — take a snapshot only when you
  need element uids to click.
- **Chrome is agent-owned.** `chrome-devtools` MCP is configured with
  `--isolated` (and **no** `--browserUrl`) so the server launches its own
  Chrome with a temp profile — never ask the user to open Chrome or run
  `scripts/chrome-debug.sh` / port 9222. Use `new_page` / tools directly;
  if connect fails, fix MCP config or Chrome install, don't hand the user
  a manual debug-port checklist.
- **Say when to `/clear`.** Session length dominates everything else: two
  long sessions accounted for half of this project's total token use. When
  a task is finished and the next one is unrelated, say so rather than
  carrying the whole transcript forward.

## Layout

- `mod/` — the PZ Lua mod that collects game state and writes it to
  `<Zomboid>/Lua/PZDashboard_*.json`.
- `server/` — single Bun app: both the backend and the companion frontend
  are served from one `bun --hot src/index.ts` process on port 3000, via
  Bun's native HTML-import route (`routes["/*"]` in `src/index.ts` serves
  `index.html`, which pulls in `src/web/`) sitting alongside the API routes
  — no separate frontend dev server, no CORS. It watches the mod's JSON
  folder and re-serves the latest state over HTTP (`/api/state*`) and a
  `/ws` WebSocket (pushes `{type:"state",category,data,updatedAt}` on every
  category update; accepts `{type:"action",action,params}` from clients and
  writes it to `PZDashboard_command.json` for the mod to pick up, replying
  with `{type:"actionAck",commandId}` — the actual result comes back later
  as a normal `commandResult` state update once the mod executes it).
  **Before running the server or editing the mod against a live game, read
  the `pz-mod-server` skill** (`.opencode/skill/pz-mod-server/SKILL.md`) — it
  covers finding the actual live Zomboid data directory (native vs Proton,
  they differ), the source-vs-deployed mod split and Lua reload workflow,
  reading `console.txt`, and Build 42 API gotchas already paid for.
  `src/web/` is the frontend: React + Mantine, implementing the
  floating-glass-HUD design from Penpot (currently v3) — a fullscreen map
  Home screen and a Health/Equipment screen, each responsive between a
  mobile layout and a wide "Ayaneo" handheld layout, plus right-edge
  drawers for weapon/clothing selection.
  `src/web/components/HudShell.tsx` is the **layout route** — the map, vitals
  pill, nav rail and hotbar all live there and stay mounted across
  navigation (only `<Outlet />` swaps), so the map keeps its pan/zoom and
  marker easing when you change screens. It deliberately holds no game
  state.
  `src/web/lib/gameSocket.ts` holds the `/ws` client (same-origin,
  auto-reconnects) as a single module-level socket shared by the whole app,
  exposed via `useGameSubscription(key, onMessage)` — built on SWR's
  `useSWRSubscription`. Each component registers its own handler and keeps
  the result in its own subscription, so state lives with the component
  that renders it rather than being threaded down from a provider. Two
  gotchas: SWR ref-counts subscriptions **per key** and only ever runs the
  first subscriber's handler for a given key, so a key names the *derived*
  state (`'vitals'`, `'hotbar'`, `'map:position'`), not the category — reuse
  a key only when you want to share the value. And the module caches the
  last snapshot per category and replays it on subscribe, because the
  socket now outlives any one screen and a late-mounting component would
  otherwise render empty until the mod next pushed that category.
  `status`, `inventory`, `toolbar`, `equipment` and `skills` are live from
  the running game (`src/web/lib/transformLiveState.ts` inverts the mod's raw
  0-1 need-stats, which run higher=worse, into the higher=better HUD
  display; the "temperature" mini-vital in the original design was swapped
  for stamina/`endurance` since the mod doesn't collect temperature). The
  Inventory screen lists live items with a working "Drop" action over the
  WS command channel. Every item list in the UI — that screen and the
  weapon/clothing selection drawers — is grouped by the game's own item
  category (`src/web/lib/itemCategories.ts`), which the mod resolves exactly
  the way the vanilla inventory pane does: `getDisplayCategory()` falling
  back to `getCategory()`, translated through the `IGUI_ItemCat_*` keys. The
  raw `category` field is kept separate and coarse on purpose — the equip
  drawers filter on it behaviorally. The map is live too: the mod streams position every
  0.5s and `MapCanvas.tsx` eases the marker between those fixes on rAF so
  it glides rather than teleports. The Skills screen is live as well: the
  mod's `skills` collector tags each perk with the parent category PZ itself
  groups it under, so `src/web/lib/skills.ts` only has to supply icons —
  the roster and its order come from the game, which matters because Build
  42 keeps adding skills. The Health screen's paperdoll centre is a live 3D
  render of the character (`src/web/components/CharacterModel.tsx`, three.js,
  drag to spin) built from the game's own assets: the mod's `appearance`
  collector reports *ids* (which `ClothingItem`, which texture choice, hair
  and beard style names) and the **server** turns those into files, because
  that means reading the game's own `clothing/clothingItems/*.xml` and
  `hairStyles/*.xml` instead of reimplementing their lookup rules in Lua.
  `src/model/` holds that: a parser for PZ's ASCII DirectX `.x` meshes, a
  case-insensitive resolver (the XML paths are lowercased Windows paths,
  fatal on Linux), and `/api/model/figure|mesh|texture`. Three gotchas are
  already paid for and easy to reintroduce — everything is **bind pose**, so
  the figure stands in a T-pose and no skinning is done; the body model
  carries hidden `Bip01_Dress*` panels that render as a slab between the
  legs unless culled; and body and garments are separate interpenetrating
  shells, so covered body triangles are removed by a point-in-mesh test
  (the game does this with `<m_Masks>`, a table that only exists in the
  engine). What's left in `src/web/mock/` is only
  `mockVitals` (a pre-connection fallback so the HUD isn't blank) and
  `mockMapPins` (the zombie/POI markers, which the mod doesn't collect).
  Liveness depends on `src/state/watcher.ts` **polling** `PZ_LUA_DIR`
  (`PZ_POLL_MS`, default 250ms) — `fs.watch` alone silently drops most
  events under the mod's write load and will strand the whole dashboard on
  a minutes-old snapshot. Don't "simplify" the poll away.
- `penpot/` — UI design work for the companion app. Design happens in a
  self-hosted Penpot instance, not Figma (quota exhausted) and not
  hand-coded HTML. **Before touching UI design, read the `penpot-local`
  skill** (`.opencode/skill/penpot-local/SKILL.md`) — it covers starting the
  local Penpot stack, connecting its MCP server, Plugin API gotchas already
  paid for, and the mandatory on-canvas versioning convention (every
  revision is a new row, never an edit in place).

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
