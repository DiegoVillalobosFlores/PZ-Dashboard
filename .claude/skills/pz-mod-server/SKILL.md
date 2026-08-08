---
name: pz-mod-server
description: How to run the Bun server and iterate on the PZ Dashboard Lua mod against a real, running Project Zomboid instance — finding the actual live Zomboid data directory (native vs Proton), the source-vs-deployed-mod split, the Lua reload workflow, reading console.txt, and build-42 API gotchas already paid for. Use whenever asked to run/test the server, edit the mod, debug missing or stale live data, or add a new data field the mod streams.
---

# PZ mod + server (live game loop)

The mod (`mod/`) streams JSON into a Zomboid data folder; the server
(`server/`) watches that folder and re-serves it over HTTP. Both pieces are
easy to run, but **the game being open is not enough on its own** — you have
to point the server at the exact folder this specific game process is
writing to, and the mod's live behavior only reflects what's actually
*deployed and loaded*, not what's in this repo. Skipping either step
produces data that looks plausible but is wrong, and that's the trap: PZ
Dashboard failures are quiet, not loud.

## 1. Ask the user for the live Zomboid directory — don't go looking for it

**Start by asking the user where the live Zomboid data directory is, and
wait for their answer.** Do not run a filesystem search for it yourself:
scanning for it is slow, and every wrong-but-plausible hit it turns up is a
chance to silently point the server at a dead directory. The user knows
which copy of the game they just launched; you don't.

Give them the command so they can answer quickly if they're unsure:

```
find / -maxdepth 10 -path "*/compatdata/108600/*" -iname Zomboid -type d 2>/dev/null
```

(`108600` is Project Zomboid's Steam App ID.) Ask them to confirm it's the
*live* one by checking which `console.txt` is updating right now while the
game is open:

```
stat -c '%y %n' ~/Zomboid/console.txt
stat -c '%y %n' <candidate-path>/console.txt
```

Whichever timestamp matches *now* is the directory currently in use.

Why this matters: the path depends on how the running copy was launched —
**native Linux** puts it at `~/Zomboid`, while **Proton** (Steam "Play"
button) puts it somewhere else entirely inside the compatdata prefix. On
this machine it's currently Proton; `server/.env.local` records the answer
from last time:

```
PZ_LUA_DIR=/games/steamapps/compatdata/108600/pfx/drive_c/users/steamuser/Zomboid/Lua/
```

Treat that as a starting suggestion to put to the user, not a fact — a
Steam library can move and the user may have switched to a native launch.
An old `~/Zomboid` from a previous native run can sit there for months,
fully populated with plausible-looking `PZDashboard_*.json` files, and
mislead you into thinking the server is reading live data when it's
actually reading a fossil. This exact mistake happened once already — don't
repeat it.

## 2. Run the server against the confirmed live directory

```
cd server
bun run dev
```

**The path lives in `server/.env.local`, not on the command line.** Bun
loads that file automatically, so `PZ_LUA_DIR` (and `PORT`,
`PZ_INSTALL_DIR`) come from there — read it to see what the server will
actually use, and if step 1 turned up a different directory, edit
`.env.local` rather than passing an inline `PZ_LUA_DIR=… bun run dev`. An
inline override works for exactly one run and then silently disappears,
leaving the next run pointed back at the stale value.

Don't fall back to the built-in default (`~/Zomboid/Lua`, see
`src/config.ts`) — it only applies when `PZ_LUA_DIR` is unset, and it's only
correct for a native install.

Verify with:

```
curl -sS http://localhost:3000/api/state | python3 -m json.tool
```

`updatedAt` on each category reflects the underlying JSON file's mtime (set
in `src/state/watcher.ts` / `src/state/store.ts`) — compare it to the current
time to sanity-check freshness before trusting any value you read. If
`updatedAt` is far in the past, you're either watching the wrong directory
(back to step 1) or the mod isn't ticking that category (step 3).

## 3. The mod has two copies — editing the repo does nothing by itself

`mod/PZDashboard/42/...` in this repo is the **source**. The game reads from
a **separately deployed copy** at
`<live-zomboid-path>/mods/PZDashboard/42/...` — it is a real directory, not a
symlink, so edits to the repo never reach the running game on their own.
After editing a `.lua` file, sync it manually:

```
cp mod/PZDashboard/42/media/lua/client/PZDashboard/PZDashboard_Collectors.lua \
   "<live-zomboid-path>/mods/PZDashboard/42/media/lua/client/PZDashboard/PZDashboard_Collectors.lua"
```

Then the game needs to actually reload that code — copying the file alone
isn't enough either, PZ already has the old version loaded in memory. Ask
the user to do one of:

- **F11** → Lua Debug → **Reload Lua**, or
- Exit to the main menu and reload the save, or
- Fully restart the game

There's no way to trigger this from outside the game process, so always ask
and wait for confirmation before re-querying the API to verify a mod change.

## 4. Debugging: `console.txt` is ground truth for mod errors

Lives at `<live-zomboid-path>/console.txt`, updates live while the game
runs. Grep it for the mod's prints and stack traces:

```
grep -n "PZDashboard\|MOD:PZ Dashboard" "<live-zomboid-path>/console.txt" | tail -60
```

Every collector field is wrapped in a `safe(fn, default, label)` helper
(`PZDashboard_Collectors.lua`) that `pcall`s the getter and prints
`[PZDashboard] <label> failed: <error>` on failure — search for that prefix
first. Note that a caught Lua error **still gets dumped as a full stack
trace to `console.txt` and still increments the in-game error counter**,
even though `safe()` swallowed it and the mod keeps running — "the error
counter went up" does not mean the JSON output stopped or is even wrong for
*other* fields, it means check the log for which specific label failed.

**The dangerous failure mode: silent wrong-zero data.** Every numeric stat
field defaults to `0` on failure — which is also a perfectly plausible real
value for a fresh character (0 hunger, 0 thirst, 0 stress...). A collector
can be completely broken and still produce output that looks like a
legitimate spawn state. This happened for real: every `stats:getX()` call
in `PZDashboard_Collectors.lua.status()` was calling methods that don't
exist on Build 42's `Stats` class, silently returning all-zero defaults for
an entire play session before anyone noticed. **Don't trust a
suspiciously-round or all-zero category as confirmation the mod is
working** — cross-check `console.txt` for `failed:` lines for that category
before declaring it healthy.

## 5. Build 42 API notes already paid for

The actual installed game's Lua source (ground truth for exact method/enum
names for this version — don't guess or rely on trained knowledge, which
predates or mismatches the exact build) is greppable locally:

```
grep -rn "<symbol>" "$PZ_INSTALL_DIR/media/lua"
```

`PZ_INSTALL_DIR` is the game *install* dir (not the Zomboid data dir from
step 1) and, like `PZ_LUA_DIR`, is recorded in `server/.env.local` — read it
from there rather than hardcoding a Steam library path, which varies per
machine. At time of writing it's
`/games/steamapps/common/ProjectZomboid/`.

Confirmed-correct patterns for this build:

- **Character stats**: there is no `stats:getHunger()`-style per-stat
  getter. Use `stats:get(CharacterStat.HUNGER)` (and `THIRST`, `FATIGUE`,
  `ENDURANCE`, `STRESS`, `PANIC`, `BOREDOM`, `PAIN` — full enum also has
  `ANGER`, `DISCOMFORT`, `FITNESS`, `FOOD_SICKNESS`, `IDLENESS`,
  `INTOXICATION`, `MORALE`, `NICOTINE_WITHDRAWAL`, `POISON`, `SANITY`,
  `SICKNESS`, `TEMPERATURE`, `UNHAPPINESS`, `WETNESS`, `ZOMBIE_FEVER`,
  `ZOMBIE_INFECTION` if more get added later).
- **`ItemContainer:getCustomName()` throws on a parentless container.** It
  dereferences `getParent():getModData()`, and `getParent()` is null for a
  container backed by an *item* rather than a world object — i.e. any bag
  lying on the floor or sitting in an inventory. Vanilla never hits this
  because it only calls `getCustomName()` on `square:getObjects()`
  containers (`ISInventoryPage.lua` ~L1740) and names item-backed ones after
  the item (`item:getName()`, ~L1701). Use `container:getContainingItem()`
  to tell the two apart, the same pair vanilla uses at
  `ISInventoryPage.lua:444-445`. This cost a 1300-entry NPE spam in
  `console.txt` — one per tick for as long as a dropped bag stayed within
  the `nearbyContainers` scan radius.
- **Character name**: not exposed by any existing collector by default.
  `player:getDescriptor():getForename()` / `:getSurname()`, and
  `player:getDisplayName()` for the display/username-style name. Already
  wired into `status` in `PZDashboard_Collectors.lua` (`forename`,
  `surname`, `displayName` fields).

When adding a new collector field, grep the real game Lua for an existing
usage of the getter you're about to call rather than assuming the method
name/signature — this is exactly how the Stats bug above got caught.
