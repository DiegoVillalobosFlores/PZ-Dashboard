# PZ Dashboard

A companion, browser-based interface for a Project Zomboid mod: the mod
streams live game state (status, map, inventory, skills, toolbar) to a local
server, and this is the second-screen UI that displays and acts on it. See

Don't write any code comments this is the most important rule you need to follow

## Working efficiently

Context is re-sent on every turn, so anything pulled in early is paid for
again on every later call. A transcript audit of this project found the
cost is almost entirely tool output — `Read` results (23%), `Bash` results
(16%), and Chrome DevTools snapshots + screenshots (22% combined). The
rules below target those.

- **Read narrowly.** Prefer `offset`/`limit` or `Grep` over reading a whole
  file when you know what you're after. `MapCanvas.tsx`,
  `PZDashboard_Collectors.lua` is the big one —
  don't pull them in whole to check one function. Never re-read a file you
  already read or just edited; `Edit`/`Write` fail loudly if they didn't
  apply, so re-reading to "verify" only buys context.
- **Filter in the shell, not in context.** Pipe through `jq`, `rg`, `bun -e`
  and print the fields you need. Don't dump a whole state JSON, mod
  `console.txt` and read it back — especially
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
  Chrome with a temp profile — never ask the user to open Chrome or use a
  manual debug port. Use `new_page` / tools directly;
  if connect fails, fix MCP config or Chrome install, don't hand the user
  a manual debug-port checklist.
- **Say when to `/clear`.** Session length dominates everything else: two
  long sessions accounted for half of this project's total token use. When
  a task is finished and the next one is unrelated, say so rather than
  carrying the whole transcript forward.

## Layout

- `mod/` — the PZ Lua mod that collects game state and writes it to
  `<Zomboid>/Lua/PZDashboard_*.json`.
- `packages/core/` contains framework-free state, map, model, icon and route
  logic behind the `GameFiles` and `Codecs` ports.
  `packages/web/` contains the shared React dashboard.
  `apps/server/` mounts core routes on Bun HTTP/WebSocket for LAN and
  second-device access. `apps/browser/` builds a static Chromium/File System
  Access client for the machine running the game - a single self-contained
  `index.html` that runs from `file://` so the mod can ship it to Workshop
  subscribers; see `apps/browser/README.md` for what `file://` costs.
  The server watches the mod's JSON folder and exposes `/api/state*`,
  `/api/action`, `/api/model/*`, `/api/map/*`, `/game-icons/*` and `/ws`.
  **Before running the server or editing the mod against a live game, read
  the `pz-mod-server` skill** (`.opencode/skill/pz-mod-server/SKILL.md`) — it
  covers finding the actual live Zomboid data directory (native vs Proton,
  they differ), the source-vs-deployed mod split and Lua reload workflow,
  reading `console.txt`, and Build 42 API gotchas already paid for.
  After changing mod files, deploy them with `bun scripts/deploy-mod.ts` from
  repository root. It reads `PZ_LUA_DIR` from `apps/server/.env.local`; use
  `PZ_LUA_DIR=/path/to/Zomboid/Lua bun scripts/deploy-mod.ts` to override it.
  Copying does not reload Lua: use F11 > Lua Debug > Reload Lua, reload the
  save, or restart the game.
  `packages/web/` is the frontend: React + Mantine, implementing the
  floating-glass-HUD design — a fullscreen map
  Home screen and a Health/Equipment screen, each responsive between a
  mobile layout and a wide "Ayaneo" handheld layout, plus right-edge
  drawers for weapon/clothing selection.
  `packages/web/components/HudShell.tsx` is the **layout route** — the map, vitals
  pill, nav rail and hotbar all live there and stay mounted across
  navigation (only `<Outlet />` swaps), so the map keeps its pan/zoom and
  marker easing when you change screens. It deliberately holds no game
  state.
  `packages/web/lib/gameSocket.ts` holds the `/ws` client or browser worker transport (same-origin,
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
  the running game (`packages/web/lib/transformLiveState.ts` inverts the mod's raw
  0-1 need-stats, which run higher=worse, into the higher=better HUD
  display; the "temperature" mini-vital in the original design was swapped
  for stamina/`endurance` since the mod doesn't collect temperature). The
  Inventory screen lists live items with a working "Drop" action over the
  WS command channel. Every item list in the UI — that screen and the
  weapon/clothing selection drawers — is grouped by the game's own item
  category (`packages/web/lib/itemCategories.ts`), which the mod resolves exactly
  the way the vanilla inventory pane does: `getDisplayCategory()` falling
  back to `getCategory()`, translated through the `IGUI_ItemCat_*` keys. The
  raw `category` field is kept separate and coarse on purpose — the equip
  drawers filter on it behaviorally. The map is live too: the mod streams position every
  0.5s and `MapCanvas.tsx` eases the marker between those fixes on rAF so
  it glides rather than teleports. The Skills screen is live as well: the
  mod's `skills` collector tags each perk with the parent category PZ itself
  groups it under, so `packages/web/lib/skills.ts` only has to supply icons —
  the roster and its order come from the game, which matters because Build
  42 keeps adding skills. The Health screen's paperdoll centre is a live 3D
  render of the character (`packages/web/components/CharacterModel.tsx`, three.js,
  drag to spin) built from the game's own assets: the mod's `appearance`
  collector reports *ids* (which `ClothingItem`, which texture choice, hair
  and beard style names) and the **server** turns those into files, because
  that means reading the game's own `clothing/clothingItems/*.xml` and
  `hairStyles/*.xml` instead of reimplementing their lookup rules in Lua.
  `packages/core/model/` holds that: a parser for PZ's ASCII DirectX `.x` meshes, a
  case-insensitive resolver (the XML paths are lowercased Windows paths,
  fatal on Linux), and `/api/model/figure|mesh|texture`. Three gotchas are
  already paid for and easy to reintroduce — everything is **bind pose**, so
  the figure stands in a T-pose and no skinning is done; the body model
  carries hidden `Bip01_Dress*` panels that render as a slab between the
  legs unless culled; and body and garments are separate interpenetrating
  shells, so covered body triangles are removed by a point-in-mesh test
  (the game does this with `<m_Masks>`, a table that only exists in the
  engine). What's left in `packages/web/mock/` is only
  `mockVitals` (a pre-connection fallback so the HUD isn't blank) and
  `mockMapPins` (the zombie/POI markers, which the mod doesn't collect).
  Liveness depends on `packages/core/state/watcher.ts` **polling** `PZ_LUA_DIR`
  (`POLL_INTERVAL_MS`/`PZ_POLL_MS`, default 100ms) — `fs.watch` alone silently drops most
  events under the mod's write load and will strand the whole dashboard on
  a minutes-old snapshot. Don't "simplify" the poll away.

## Reading the game's own files

Balance and mechanics questions ("what does this trait actually do", "how
much fatigue does coffee remove", "which beds count as good") are answered
from the game install at `PZ_INSTALL_DIR`
(`/games/steamapps/common/ProjectZomboid`, set in `apps/server/.env.local`),
not from this repo. Three separate sources, and the numbers that matter are
usually in the third:

- `media/scripts/generated/**.txt` — item, trait, profession, recipe and
  fluid stats. Plain text, greppable. Food stat fields are hundredths of a
  stat bar (`fatigueChange = -50` is half the bar), and recipe inputs like
  `item 5 [Base.Coffee2]` are **hunger units**, not item counts — a food's
  unit pool is its `HungerChange`, so 5 units off a 30-hunger jar is a sixth
  of it.
- `media/lua/` — plain Lua source, greppable, and the half of the logic
  mods can see.
- `projectzomboid.jar` — compiled but **not obfuscated**. Every trait
  multiplier, the fatigue/sleep rates, and each recipe's `OnCreate` hook
  live here as bytecode operands that no grep will ever find.

Decompile rather than reading bytecode by hand: `cfr <path>/Foo.class`
(wrapper at `~/.local/bin/cfr`, jar in `~/.local/share/java/cfr.jar`, needs
`jdk-openjdk`), or `cfr --outputdir <dir> projectzomboid.jar --jarfilter
'zombie.characters.*'` for a whole package. Add `--methodname <name>` to
print one method. Extract classes first with
`unzip -q projectzomboid.jar 'zombie/characters/*' -d <dir>` when you only
need a subtree. **Never read a class as a filtered dump of its constants and
method names** — that strips the surrounding `fdiv`/`fstore`, which is what
says whether a constant multiplies or divides a rate, and reading a trait
backwards that way has already happened once.

Tile-driven properties (`BedType` good/average/bad, `bed`, `container`) are
in `media/newtiledefinitions.tiles.txt`: `tileset` blocks, one `tile { }`
block per sprite, sprite names carried in the preceding `// name` comment
and human labels in `CustomName`. Item and trait display names resolve
through `media/lua/shared/Translate/EN/*.json` — a trait's script name and
its UI name often differ (`base:insomniac` is "Restless Sleeper",
`base:needslesssleep` is "Wakeful").

## Lua tooling

`.luarc.json` at the repository root configures `lua-language-server` for
`mod/`. It sets the runtime to Lua 5.1 (Kahlua2) and puts the game's own
`media/lua/{shared,client,server}` on `workspace.library`, so vanilla
classes — `ISTimedActionQueue`, `ISInventoryPaneContextMenu`, `luautils` —
resolve to real definitions rather than being flagged undefined. Only
genuinely Java-exposed globals (`getPlayer`, `CharacterStat`, `PerkFactory`,
`instanceof`, …) are declared in `diagnostics.globals`; add to that list
when the mod starts using a new engine global, rather than switching
`undefined-global` off. Check the mod from the command line with:

    lua-language-server --check "$PWD/mod" --checklevel=Warning --configpath="$PWD/.luarc.json"

The `workspace.library` paths are absolute and match this machine's Proton
install; a different install location needs them edited.

## Git

Never create a branch. Commit and push straight to `master`.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
