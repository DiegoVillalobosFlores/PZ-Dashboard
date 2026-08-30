# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Project Zomboid (Build 42) players who play with a second screen. Distribution
is a public Steam Workshop release, so the primary user is a stranger who
subscribes to the mod and has never seen the dashboard before: setup has to be
forgiving and defaults have to be right without configuration.

Two viewing contexts are primary and equally weighted:

- **A handheld or small wide screen** (~1620x1080, Ayaneo class) sitting next
  to the keyboard, driven by the Bun server over the LAN.
- **The game machine itself**, running the single-file `Dashboard.html` in
  Chrome or Edge from disk, typically on a second monitor.

Phone portrait (390x844) is supported and must not break, but it is not the
layout decisions are optimized for.

The user is *playing the game* while reading this screen. Glanceability under
divided attention, at arm's length, is the operating reality.

## Product Purpose

Surface live Project Zomboid character and world state on a second screen, and
let the player act on it — move items, equip, wear — without leaving the game's
first-person view or pausing to open vanilla panes.

Success is the player keeping their eyes and hands in the game while the
dashboard covers inventory triage, gear changes, health, skills and navigation.

## Positioning

The mod is confined to the PZ Lua sandbox, which has no network access. The
product's mechanism is a **file-drop bridge in both directions**: the mod
writes JSON snapshots into `<Zomboid>/Lua/PZDashboard_<category>.json`, and
commands travel back through `PZDashboard_command.json`. Two clients read that
folder — a Bun server for other devices on the LAN, and a File System Access
build that runs from `file://` on the game machine with no server at all.

Write commands are executed through *vanilla's own context-menu handlers*, so
they inherit real animations, timed actions and edge cases rather than
reimplementing them. That is the difference from a read-only overlay: the
dashboard acts on the game and the game stays authoritative.

Data derived from the game's own assets, not reimplemented: item categories via
`getDisplayCategory()`, the skills roster and its grouping, fog of war from the
in-game visited-map data, road routing from the game's vector map data, and the
3D character built from the game's own `.x` meshes, clothing XML and textures.

## Operating Context

- The game is running and in the foreground. The dashboard is peripheral.
- State arrives as polled JSON snapshots (`packages/core/state/watcher.ts`
  polls `PZ_LUA_DIR`; `fs.watch` alone drops events under load). Categories
  update at per-category intervals the player controls in-game under
  **Options > Mods > PZ Dashboard**, so any category can be off, stale, or
  never-yet-populated — a manifest distinguishes those cases.
- Map position streams ~4x/second; the marker eases between fixes on rAF.
  0.1s sampling while in a vehicle, but only at default interval.
- The map is a persistent layout route (`HudShell.tsx`): map, vitals pill, nav
  rail and hotbar stay mounted across navigation; only `<Outlet />` swaps.
- Keys `1`–`5` switch screens, `Escape` returns to the map.
- On Linux the paths the in-game UI shows are the paths the *game* sees; native
  and Proton installs differ and both browser and server live outside that view.
- Streaming costs in-game performance, which is why every category is
  individually switchable. More data is not automatically better.

## Capabilities and Constraints

Live from the game: status and need stats, world clock, position and facing,
explored-map fog grid, vehicles, map annotations, containers (inventory, bags,
vehicle storage, nearby crates, corpses, floor bags, ground items), skills,
traits, toolbar/hands, worn equipment, appearance ids.

Actions back into the game: move items between any two enumerated containers
(including floor pickup and drop), equip primary/secondary hand, wear clothing,
unequip from hand or body. Reachability and weight-capacity are checked before
anything is queued.

Screens: Home (map), Health, Inventory, Skills, Settings.

Constraints:

- Two build targets must both work: LAN server, and a **single self-contained
  `index.html`** running from `file://` with no server (see
  `apps/browser/README.md` for what `file://` costs).
- No code comments anywhere in this repo.
- Stack is fixed: React 19 + Mantine 9, react-router, SWR, three.js, Bun.
- The character render is **bind pose** — T-pose, no skinning. Known gotchas:
  hidden `Bip01_Dress*` panels must be culled; body/garment shells
  interpenetrate and covered triangles are removed by a point-in-mesh test.
- Not collected by the mod: temperature as a vital (stamina/`endurance` stands
  in), zombie and POI markers (`mockMapPins` is placeholder, not live data).
- Raw need stats run 0–1 higher=worse and are inverted for display in
  `transformLiveState.ts`.

## Brand Commitments

Name: **PZ Dashboard**. The existing visual direction is a floating-glass HUD
over a fullscreen map — treat it as the incumbent world, recorded separately in
DESIGN.md, not as a product fact.

The dashboard is a companion to Project Zomboid and should read as belonging
next to it, not as a generic web app.

## Evidence on Hand

- Real captured screenshots of every screen in `docs/screenshots/` (home,
  health, inventory, skills, settings, mobile-health).
- Live game data end to end — nothing in the product needs mocked content
  except `mockVitals` (pre-connection fallback) and `mockMapPins`.
- Penpot design source in `penpot/`.
- Prior design notes in `docs/plans/` for unbuilt work (character animation,
  3D map).

No testimonials, user counts, reviews, Workshop metrics or press exist. Do not
invent them.

## Product Principles

1. **The game is authoritative.** Read the game's own data and route actions
   through its own handlers; never reimplement its rules in the dashboard.
2. **Peripheral, not primary.** The player's attention is in the game. Design
   for a glance at arm's length, not for a focused reading session.
3. **Continuity beats screens.** The map and shell never unmount; state, pan,
   zoom and easing survive navigation.
4. **Honest about absence.** Off, stale and never-received are different
   states and must look different; the last known reading stays visible, dimmed,
   rather than blanking.
5. **Both clients are first-class.** Anything that only works with a server is
   not done — `file://` on the game machine ships to Workshop subscribers.

## Accessibility & Inclusion

No formal standard has been set. Product-specific needs from the operating
context: legible at handheld arm's length, touch targets sized for a handheld's
touchscreen and for a phone, and full keyboard navigation (`1`–`5`, `Escape`
already exist) since the player's hands are on a keyboard.
