# PZDashboard mod

Client-side Project Zomboid (Build 42) mod that periodically collects live
game state and writes it to `<Zomboid>/Lua/PZDashboard_<category>.json` via
the game's `getFileWriter` API, one file per category. The companion Bun
server (`../server`) watches that folder and serves the latest snapshots over
HTTP/WebSocket. The same folder is the inbound channel: the server writes
`PZDashboard_command.json` and the mod polls it and executes the action.

There is no direct HTTP/socket access from the PZ Lua sandbox, so the file
drop is the integration point rather than the mod calling the server itself.

## How it runs

Everything hangs off a single `Events.OnTick` handler
(`PZDashboard_Main.lua`). Each tick it:

1. Polls `PZDashboard_command.json` every 300ms and runs at most one command
   per command id, replying with a `PZDashboard_commandResult.json` snapshot
   (`{ id, ok, error }`).
2. Runs each enabled collector whose own interval has elapsed and writes its
   category file.
3. Writes `PZDashboard_manifest.json` every second, listing which categories
   are enabled and when each last updated, so the server can tell "disabled"
   apart from "no data yet".

Collectors run under `pcall`, and every individual getter inside them goes
through `PZDashboard.Util.safe(fn, default, label)`, which returns a default
and prints `PZDashboard: <label> failed: ...` once per label. One broken
getter degrades a single field instead of killing the snapshot.

## Streamed categories

Each category has its own on/off switch and update interval, exposed under
**Options > Mods > PZ Dashboard** (built with `PZAPI.ModOptions`) so you can
trade off how much gets streamed against in-game performance. These are
global engine settings (saved to `Zomboid/Lua/ModOptions.ini`), so they're
editable live from that menu at any time — not locked in at world creation
like Sandbox Options are. Interval sliders run from 0.25s in 0.25s steps up
to the per-category maximum.

| id | file | default interval | max |
|----|------|------------------|-----|
| `status` | `PZDashboard_status.json` | 1s | 30s |
| `map` | `PZDashboard_map.json` | 0.25s | 30s |
| `vehicles` | `PZDashboard_vehicles.json` | 2s | 60s |
| `annotations` | `PZDashboard_annotations.json` | 5s | 60s |
| `containers` | `PZDashboard_containers.json` | 2s | 60s |
| `skills` | `PZDashboard_skills.json` | 5s | 60s |
| `toolbar` | `PZDashboard_toolbar.json` | 1s | 30s |
| `equipment` | `PZDashboard_equipment.json` | 1s | 30s |
| `appearance` | `PZDashboard_appearance.json` | 2s | 60s |

### status

Character name (forename, surname, display name), overall body health, and
the raw `CharacterStat` need values: hunger, thirst, fatigue, endurance,
stress, panic, boredom, pain. These run 0-1 and *higher is worse* — the
dashboard inverts them for display. Plus two flags: `infected`, and
`bleeding` (true if any body part has a non-zero bleeding time).

### map

Player position (`x`, `y`, `z`), forward direction vector (`dirX`, `dirY`),
whether the player has a safehouse, and whether they're currently in a
vehicle. Streamed fast (0.25s default) because the dashboard eases the map
marker between fixes.

### vehicles

Last known position of every vehicle the player has driven this session,
keyed by vehicle id and kept in a module-level table, so a car you parked
stays on the map after you walk away. Each entry carries `id`, `name` (the
vehicle script name), `x`/`y`/`z`, and `current` (true for the vehicle the
player is in right now). The table is session-lived; it isn't persisted.

### annotations

User-drawn markers from the in-game world map — text notes and stamps —
with world coordinates, RGB colour, rotation, author, and either `text` or
`symbolId`. Only `isUserDefined()` symbols are reported. Reading these
requires a `UIWorldMap` instance, so the collector lazily builds a headless
one, points it at `MapItem.getSingleton()`, and calls
`initDefaultAnnotations()` once, then reuses that API on later ticks.

### containers

The full nearby-storage picture, from `PZDashboard.Containers.enumerate()`:

- the player's own inventory (`player`),
- every bag being carried (`bag:<itemId>`),
- if in a vehicle, its global inventory plus every part with an item
  container — glovebox, trunk, seats (`vehicle:<id>:<partId>`),
- every world object with a container in a 3x3 square around the player
  (`obj:<x>:<y>:<z>:<index>`), with `locked` set for locked `IsoThumpable`s,
- corpses on those squares (`body:<x>:<y>:<z>:<index>`),
- bags lying on the ground (`floorBag:<itemId>`),
- and a synthetic `floor` container holding the loose items on those squares.

Each record reports `id`, `kind`, `name` (translated container title where
one exists), `type`, `icon`, position, `locked`, current `weight` and
`capacity` (the player's `getMaxWeight()` for their own inventory), plus the
items. Each item snapshot carries id, display name, full type, condition and
max condition, weight, icon texture name, `equipped` (hand-equipped, worn or
attached), `bodyLocation` for clothing, and both the coarse `category` and
the game's own `displayCategory`/`categoryLabel` — resolved the way the
vanilla inventory pane does it, `getDisplayCategory()` falling back to
`getCategory()`, translated through `IGUI_ItemCat_*`.

### skills

Every perk in `PerkFactory.PerkList` that has a real parent category, tagged
with the category PZ itself groups it under (`category`, `categoryName`), so
the dashboard doesn't have to hardcode a roster that Build 42 keeps adding
to. Per perk: `id`, `name`, `passive`, `level`, current `xp`, and the XP
thresholds bounding the current level (`xpLevelStart`, `xpLevelEnd`).

### toolbar

Primary and secondary hand items, plus every attached hotbar slot with its
`location`. Item snapshots include display name, full type, icon, condition,
and — for ranged `HandWeapon`s — `ammo` and `ammoMax`.

### equipment

Worn clothing: one snapshot per `WornItem`, each with its body `location`.

### appearance

Everything needed to rebuild the character's 3D model server-side: `female`,
skin texture index and name, hair and beard model names with their colours,
and for each worn garment the `clothingItem` id, body location, `hasModel`,
`textureChoice`, `baseTexture` and `tint`. The mod deliberately reports
*ids*, not file paths — the server resolves those against the game's own
`clothing/clothingItems/*.xml` and `hairStyles/*.xml` rather than
reimplementing PZ's lookup rules in Lua.

## Commands (server -> mod)

The server writes a single-line `PZDashboard_command.json`
(`{ id, action, params }`); the mod runs it once per id and writes the
outcome back as `commandResult`. Handlers live in `PZDashboard_Actions.lua`.

| action | params | effect |
|--------|--------|--------|
| `ping` | — | no-op round-trip check |
| `moveItems` | `{ to: containerId, itemIds: [n, ...] }` | moves items between any enumerated containers |
| `equipPrimary` | `{ itemType }` | equips in the primary hand |
| `equipSecondary` | `{ itemType }` | equips in the secondary hand |
| `wearItem` | `{ itemType }` | wears a clothing item (PZ picks the slot) |
| `unequipItem` | `{ itemType }` | unequips from hand or body |

Equip/wear/unequip delegate to the vanilla `ISInventoryPaneContextMenu`
handlers the in-game inventory uses, so they inherit the equip animation,
two-handed weapon rules, candle-snuffing on unequip and so on. Because those
queue timed actions, a successful reply means "queued", not "done" — the
real outcome shows up in the next `equipment`/`toolbar` snapshot.

`moveItems` covers container-to-container, pick-up-from-floor (via
`ISGrabItemAction`, or a transfer action in MP) and drop-to-floor, and gates
the batch before queuing anything: the destination must still exist and be
unlocked, items are matched by the ids the last enumeration handed out, a
projected-weight check admits only what fits, and reachability
(`luautils.walkToContainer`) is checked for every source and the destination
first — because a walk clears the whole timed-action queue and would throw
already-queued transfers away.

## Install (for testing)

Copy `mod/PZDashboard` into your Zomboid mods folder (symlinks are not
reliably picked up under Proton — copy instead):

- Native Linux build: `~/Zomboid/mods/PZDashboard`
- Proton/Windows build: `<compatdata prefix>/pfx/drive_c/users/steamuser/Zomboid/mods/PZDashboard`
  (e.g. `~/.local/share/Steam/steamapps/compatdata/108600/pfx/drive_c/users/steamuser/Zomboid/mods/PZDashboard`)

Enable "PZ Dashboard" from the in-game Mods menu (restart required), then
adjust streaming options from **Options > Mods > PZ Dashboard**.

For source changes during development, run `bun scripts/deploy-mod.ts` from the
repository root. It reads `PZ_LUA_DIR` from `server/.env.local` and copies the
source mod into the matching `Zomboid/mods/PZDashboard` directory. Override
the target with `PZ_LUA_DIR=/path/to/Zomboid/Lua bun scripts/deploy-mod.ts`.
Reload Lua with F11 > Lua Debug > Reload Lua, reload the save, or restart the
game after deployment.

## File layout

```
PZDashboard/
  common/                     empty, but required by the B42 mod loader
  42/
    mod.info
    media/lua/shared/Json.lua                 minimal JSON encode/decode
    media/lua/shared/PZDashboard/
      PZDashboard_Categories.lua              category table (ids, options, intervals)
    media/lua/client/PZDashboard/
      PZDashboard_Main.lua                    OnTick loop, command dispatch, manifest
      PZDashboard_Options.lua                 Options > Mods page
      PZDashboard_Config.lua                  enabled/interval lookups
      PZDashboard_Collectors.lua              one function per category
      PZDashboard_Containers.lua              nearby-container enumeration
      PZDashboard_Writer.lua                  JSON snapshot writes
      PZDashboard_Reader.lua                  command file reads
      PZDashboard_Util.lua                    safe(), item category resolution
```

## Notable things learned getting this working

- **Build 42 requires the versioned mod layout**: `mod.info` and `media/` go
  inside a `42/` subfolder, with an (even empty) `common/` folder alongside
  it. The older flat `mod.info` + `media/` at the mod root (still used by
  the game's own bundled `examplemod`) is not picked up for third-party
  mods — it silently doesn't appear in Select Mods, with no error logged.
- **`mod.info` needs CRLF line endings.** LF-only was one contributing
  factor during setup; every known-good `mod.info` (bundled and Workshop)
  uses `\r\n`.
- **There is no built-in `Json` Lua module.** Despite some modding docs
  implying otherwise, `require "Json"` fails unless a mod supplies its own —
  see `42/media/lua/shared/Json.lua`.
- **PZ's own exception log for a caught Lua error can have a blank
  message.** `safe()` prints the real pcall error itself, which is what
  actually revealed which getters were wrong on this build. Check
  `console.txt` for `PZDashboard: <field> failed:` lines when a snapshot
  looks sparse, and treat the class docs as a starting point rather than
  ground truth for the exact build in use.
- **Item ids come off the wire as JSON numbers**, and `Json.Decode` yields
  Lua doubles — `moveItems` compares them numerically because `tostring()`
  on a Kahlua double can render an integer id as `"12345.0"` and never match.
