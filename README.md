# PZ Dashboard

A second-screen companion for Project Zomboid (Build 42). A client-side Lua
mod streams live game state out of the running game, and a browser dashboard
displays it — and acts on it. Two ways to view: a single self-contained HTML
file that ships inside the mod and runs straight from disk on the game
machine, or a local Bun server for a phone, tablet or handheld on the same
network.

The PZ Lua sandbox has no network access, so the mod writes JSON snapshots
into `<Zomboid>/Lua/PZDashboard_<category>.json`. The same folder carries
commands the other way, so the dashboard can move items and change gear, not
just display them.

```
Project Zomboid  ──(JSON files in <Zomboid>/Lua/)──>  Bun server  ──(HTTP + WebSocket)──>  browser
                  <──(PZDashboard_command.json)─────

Dashboard.html ──(File System Access API, game machine only)──> dashboard
```

![Map screen](docs/screenshots/home.webp)

The map is the home screen and stays mounted behind everything else: pan and
zoom survive navigation, the player marker eases between position fixes, and
fog of war hides everything you haven't uncovered in the in-game map yet.
Tap anywhere on the map to route there — the dashboard reads the game's own
vector map data and follows roads, falling back to a straight line when no
path exists.

## Features

### Live state, streamed out of the game

- **Status** — name, overall health and the raw need stats (hunger, thirst,
  fatigue, endurance, stress, panic, boredom, pain), panic resistance, plus
  infection and bleeding flags and the world clock: in-game time, day, date
  and temperature.
- **Position & map** — player coordinates, facing direction, safehouse and
  in-vehicle flags, pushed 4x a second so the map marker glides instead of
  teleporting.
- **Explored map** — the fog-of-war grid from the game's own visited-map
  data, so the dashboard map only shows ground you have actually seen.
- **Vehicles** — last known position of every vehicle driven this session,
  so a parked car stays on the map after you walk away. The browser
  remembers the last one across game restarts.
- **Map annotations** — the notes and stamps you drew on the in-game world
  map, with their colour, rotation and author, on the map and in a
  side drawer.
- **Containers** — the player's inventory, every carried bag, the vehicle's
  glovebox/trunk/seats when driving, every nearby crate, corpse, floor bag
  and loose item on the ground, each with weight, capacity, lock state and
  full item lists.
- **Skills** — every perk with level, XP and the thresholds around it,
  grouped by the category the game itself puts it in (so new Build 42 skills
  appear without a code change).
- **Traits** — every trait the character has, with its description, cost and
  the XP boosts it grants, positive and negative split apart.
- **Toolbar** — primary and secondary hand items and attached hotbar slots,
  including ammo counts for ranged weapons.
- **Equipment** — worn clothing by body location.
- **Appearance** — skin, hair, beard and per-garment texture/tint ids used to
  rebuild the character in 3D.

Every category has its own on/off switch and update interval under
**Options > Mods > PZ Dashboard**, editable live, so you can trade streamed
detail against in-game performance. A manifest file reports which categories
are on and when each last updated, so the dashboard can tell "off" apart from
"no data yet" — and the vitals pill keeps its last reading on screen, dimmed,
when the game or the server goes away.

### Acting on the game from the dashboard

Commands travel back through the same file drop and are executed through
vanilla's own context-menu handlers, so they inherit the real animations,
timed actions and special cases:

- move items between any two enumerated containers, including picking up off
  the floor and dropping to it, with reachability and weight-capacity checks
  before anything is queued
- equip in the primary or secondary hand
- wear a clothing item
- unequip from hand or body

### The dashboard itself

Five screens, all sharing one persistent shell: the map, the vitals pill, the
nav rail and the hotbar never unmount, so switching screens never resets the
map or drops a frame of the marker's easing. Keys `1`–`5` jump between
screens and `Escape` closes back to the map.

**Health** — a live 3D render of your character, built from the game's own
meshes and textures using the ids the mod reports. Drag to spin it. The
equipment grid beside it is every body location, and tapping one opens a
drawer to change what's worn there.

![Health screen](docs/screenshots/health.webp)

**Inventory** — every container in reach at once: your inventory and bags, the
vehicle's glovebox and trunk when driving, nearby crates, corpses, floor bags
and loose ground items. Search spans all of them, items are grouped by the
game's own categories, and moving something between two containers goes
through vanilla's own handlers, animations and all.

![Inventory screen](docs/screenshots/inventory.webp)

**Skills** — every perk with its level and XP bar, grouped by the category the
game itself puts it in, alongside the character's traits and what each one
does.

![Skills screen](docs/screenshots/skills.webp)

**Settings** — dashboard-side toggles: fog of war, the traits list, and the
vitals pill down to individual stats. The mod-side switches (which categories
stream, and how often) live in-game under **Options > Mods > PZ Dashboard**.

![Settings screen](docs/screenshots/settings.webp)

Every screen is responsive between a phone layout and a wide handheld layout,
so the same dashboard works on a phone propped next to the keyboard or on a
second screen the size of an Ayaneo.

<img src="docs/screenshots/mobile-health.webp" width="320" alt="Health screen on a phone">

## Install

Enable **PZ Dashboard** in the in-game Mods menu, then pick how you want to
view it.

**On the machine running the game.** The mod folder contains
`Dashboard.html` — the entire dashboard in one file. Open it in Chrome or
Edge; it asks once for your `Zomboid` folder (read and write, so it can send
commands back) and then, for the map and character screens, for the game
install folder (read-only). Both are remembered. No server, no network.

**On a phone, tablet or handheld.** Run the Bun server on the game machine
and open `http://<that machine>:3000` on the other device. See
[`apps/server/README.md`](apps/server/README.md).

**On Linux**, the paths the copy buttons in **Options > Mods > PZ Dashboard**
hand you are the paths the *game* sees, and both the browser and the server
run outside that view, so translate them first:

| Game shows | Native build | Proton / Steam Play |
|---|---|---|
| `C:\users\steamuser\Zomboid` | `~/Zomboid` | `<Steam>/steamapps/compatdata/108600/pfx/drive_c/users/steamuser/Zomboid` |

`<Steam>` is usually `~/.local/share/Steam`, or the library folder you
installed the game into. Subscribed Workshop mods live outside that prefix
altogether, under `<Steam>/steamapps/workshop/content/108600/<id>/mods/PZDashboard`,
which is where `Dashboard.html` will be. Everything else is the same: point
the browser's folder picker, or `PZ_LUA_DIR`, at the translated path.

## Development

- `mod/` — the Project Zomboid Build 42 mod. See [`mod/README.md`](mod/README.md)
  for the exact category schemas, command protocol and install steps.
- `packages/core/` — portable state, map, model, icon and route logic.
- `packages/web/` — shared React dashboard.
- `apps/server/` — Bun HTTP/WebSocket server for LAN and second-device use.
- `apps/browser/` — the static File System Access build that becomes
  `Dashboard.html`. See [`apps/browser/README.md`](apps/browser/README.md).
- `docs/plans/` — design notes for work that isn't built yet:
  [animating the character model](docs/plans/CHARACTER_ANIMATION_PLAN.md) and
  [a 3D map](docs/plans/MAP_3D_PLAN.md).

```sh
bun install
bun scripts/deploy-mod.ts        # copy the mod into Zomboid/mods
cd apps/server && bun run dev    # dashboard on http://localhost:3000
```

`scripts/deploy-mod.ts` reads `PZ_LUA_DIR` from `apps/server/.env.local`;
override it with `PZ_LUA_DIR=/path/to/Zomboid/Lua bun scripts/deploy-mod.ts`.
Copying does not reload Lua — use F11 > Lua Debug > Reload Lua, reload the
save, or restart the game.

### Packaging for the Steam Workshop

```sh
bun scripts/package-workshop.ts
```

Builds `apps/browser`, then stages the mod plus the built `Dashboard.html`
into `<Zomboid>/Workshop/PZDashboard/Contents/mods/PZDashboard` and writes a
starter `workshop.txt` beside it (left alone once it exists, so the id Steam
assigns on first upload survives re-runs). Pass `--out <dir>` to stage
somewhere else, `--no-build` to reuse the existing browser build. Upload from
the game's own Workshop > Create/Update Item screen.

The script warns about the two things it can't generate: `preview.png` for
the Workshop listing, and `poster.png` / `icon.png` for the in-game mod list.
