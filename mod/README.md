# PZDashboard mod

Client-side Project Zomboid mod that periodically collects live game state
and writes it to `<Zomboid>/Lua/PZDashboard_<category>.json` via the game's
`getFileWriter` API, one file per category. The companion Bun server
(`../server`) watches that folder and serves the latest snapshots over HTTP.

There is no direct HTTP/socket access from the PZ Lua sandbox, so the file
drop is the integration point rather than the mod calling the server itself.

## Categories

Each category has its own on/off switch and update interval, exposed under
**Options > Mods > PZ Dashboard** so you can trade off how much gets
streamed against in-game performance. These are global engine settings
(saved to `Zomboid/Lua/ModOptions.ini`), so they're editable live from that
menu at any time — not locked in at world creation like Sandbox Options are.

| id        | file                              | default interval |
|-----------|------------------------------------|-------------------|
| status    | `PZDashboard_status.json`          | 1s |
| map       | `PZDashboard_map.json`             | 1s |
| annotations | `PZDashboard_annotations.json`   | 5s |
| inventory | `PZDashboard_inventory.json`       | 3s |
| skills    | `PZDashboard_skills.json`          | 5s |
| toolbar   | `PZDashboard_toolbar.json`         | 1s |

A `PZDashboard_manifest.json` is written every second listing which
categories are currently enabled and when each last updated, so the server
can tell "disabled" apart from "no data yet".

## Install (for testing)

Copy `mod/PZDashboard` into your Zomboid mods folder (symlinks are not
reliably picked up under Proton — copy instead):

- Native Linux build: `~/Zomboid/mods/PZDashboard`
- Proton/Windows build: `<compatdata prefix>/pfx/drive_c/users/steamuser/Zomboid/mods/PZDashboard`
  (e.g. `~/.local/share/Steam/steamapps/compatdata/108600/pfx/drive_c/users/steamuser/Zomboid/mods/PZDashboard`)

Enable "PZ Dashboard" from the in-game Mods menu (restart required), then
adjust streaming options from **Options > Mods > PZ Dashboard**.

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
  see `42/media/lua/shared/Json.lua` (minimal encode-only implementation).
- **PZ's own exception log for a caught Lua error can have a blank
  message.** `safe()` in `PZDashboard_Collectors.lua` prints the real pcall
  error itself (`[PZDashboard] <label> failed: ...`) rather than relying on
  the engine's dump, which is what actually revealed which getters were
  wrong on this build.

## Known unknowns

- **Toolbar/hotbar collector** (`PZDashboard_Collectors.lua`) is the
  shakiest part — Build 42 reworked hotbar/attachment slots and the exact
  getters (`getAttachedItems`, `slot:getLocation()`) should be confirmed
  against the in-game Lua IDE if it comes back empty.
- A handful of `Stats` getters (thirst/fatigue/endurance/stress/panic/
  boredom/pain) were throwing at runtime on this build despite matching the
  official class docs; check `console.txt` for `[PZDashboard] status.*
  failed:` lines if `status.json` looks sparse, and treat the docs as a
  starting point rather than ground truth for the exact build in use.
