## Context

See proposal.md — Why. What already exists and shapes the approach:

- `PZDashboard.Collectors.vehicles` already resolves `player:getVehicle()`,
  keeps a module-level `trackedVehicles` table across ticks, and marks exactly
  one entry `current = true`. It publishes identity and position only.
- `PZDashboard_Main.lua:63-67` already implements a per-category driving
  cadence: if a category declares `vehicleInterval` and the player is in a
  vehicle *and* the player has not raised the interval above the default, the
  category runs at `vehicleInterval` instead. Today only `map` uses it.
- `map.inVehicle` is already collected and already streams at 0.1s while
  driving, faster than the `vehicles` category will.
- The web app has no provider: `useGameSubscription(key, handler)` is the only
  way in, and SWR ref-counts per key and runs **only the first subscriber's
  handler for a given key**. `MapCanvas.tsx:176` already owns `'map:vehicles'`
  and `MapCanvas.tsx:170` owns `'map:position'`.
- `HudShell.tsx` is the layout route: anything mounted there survives
  navigation between screens.
- Settings are `useLocalStorage` hooks in `packages/web/lib/settings.ts`,
  rendered by `SettingsScreen.tsx` into named sections.

Method names below were read from the installed game's own Lua
(`ISVehicleDashboard.lua`), not from memory, per the `pz-mod-server` skill.

## Goals / Non-Goals

**Goals:**

- Readouts that agree with the game's own dashboard, using the same getters it
  uses.
- No new category, no new server route, no new dependency.
- Telemetry cost paid only while driving.

**Non-Goals:**

- Acting on the vehicle from the dashboard (start engine, toggle headlights,
  honk). Read-only; the command channel exists but wiring vehicle actions is a
  separate change.
- Telemetry for vehicles the player is not in. `trackedVehicles` keeps their
  last position for the map; it will not gain live readings.
- A speedometer dial or any 3D/vehicle-model rendering.
- Per-part mechanic detail (the vanilla mechanics overlay). One aggregate
  condition figure only.

## Decisions

### Extend the `vehicles` category rather than add a `driving` one

The collector already resolves the current vehicle every tick, the category
already flows through the watcher, `/api/state` and `/ws`, and the Settings and
mod-options plumbing already enumerate it. A new category would add a mod
option, a manifest entry, a category row and a second file write per tick to
publish fields that belong to a vehicle we are already describing.

Alternative considered: a `driving` category so the telemetry can be disabled
independently of map vehicle markers. Rejected — the existing `VehiclesEnabled`
option already covers "I don't want this", and the driving HUD has its own
dashboard-side toggle.

### Telemetry is written only onto the current entry, and cleared when it stops being current

`trackedVehicles` entries persist across ticks by design (the map keeps showing
where you parked). If telemetry were written onto a tracked entry and left
there, a parked car would keep reporting the speed and fuel it had when the
player got out — a stale reading indistinguishable from a live one, which the
spec forbids. The collector will nil the telemetry fields on every entry in the
same loop that already sets `current = false`, then populate them only on the
entry it marks current.

### Published fields, and the getter behind each

| Field | Source | Units |
| --- | --- | --- |
| `speedKmh` | `vehicle:getCurrentSpeedKmHour()` | km/h, signed (negative in reverse) |
| `gear` | `vehicle:getTransmissionNumberLetter()` | letter, e.g. `R`, `1`, `P` |
| `engineRunning` | `vehicle:isEngineRunning()` | bool |
| `engineStarted` | `vehicle:isEngineStarted()` | bool |
| `keysInIgnition` | `vehicle:isKeysInIgnition()` | bool |
| `fuelPercent` | `vehicle:getRemainingFuelPercentage()` | 0-100 |
| `battery` | `vehicle:getBatteryCharge()` | 0-1 |
| `headlightsOn` | `vehicle:getHeadlightsOn()` | bool |
| `engineCondition` | `vehicle:getPartById("Engine"):getCondition()` | 0-100 |
| `worstPartCondition` | min over `getPartByIndex(0..getPartCount()-1)` | 0-100 |

Every one goes through the collector's existing `safe()` wrapper, so a getter
that errors or a missing part yields `nil` and the field is simply absent from
the JSON — which is what the spec's "reading unavailable" scenarios require and
what makes an older mod build degrade rather than break.

`getRemainingFuelPercentage()` is used rather than the vanilla gauge's
`getPartById("GasTank"):getContainerContentAmount() / :getContainerCapacity()`:
the same number without the part lookup and the `isContainer()` /
`getContainerContentType()` guards, and it is the call vanilla itself uses for
the low-fuel warning (`ISVehicleDashboard.lua:370`). A vehicle with no tank
returns nothing useful and the field drops out, which the HUD renders as
unavailable.

`worstPartCondition` is one pass over the part list, mirroring what
`ISVehicleDashboard.getVehicleCondition` does. Vanilla builds a full
part→condition table because it diffs it tick over tick to detect new damage;
the HUD only needs the aggregate, so we reduce to a minimum in the loop.

**Speed is published raw.** The in-game needle multiplies by
`BaseVehicle.getFakeSpeedModifier()` (`ISVehicleDashboard.lua:256`), so the
HUD's number can read lower than the needle the player sees in the game
window. The true value is the more useful one on a second screen, and the
modifier is a display flourish rather than a unit conversion.

### Driving cadence is one field

Add `vehicleInterval = 0.5` to the `vehicles` row in
`PZDashboard_Categories.lua`. `Main.lua` already does the rest, including
honouring a player who raised `VehiclesInterval` above the default — which is
exactly the spec's "configured interval is respected" scenario, satisfied
without new code.

0.5s rather than `map`'s 0.1s: speed, fuel and warning lights do not need
10Hz, and `vehicles` serialises every tracked vehicle on every write, so its
per-tick cost grows with how much the player has driven. Position smoothing
already runs off `map` at 0.1s and is unaffected.

### Visibility keys off `map.inVehicle`, readouts off the current vehicle

`map.inVehicle` arrives at 0.1s while driving; `vehicles` at 0.5s. Keying
show/hide off `inVehicle` makes the HUD appear and disappear promptly on enter
and exit, rather than lagging up to half a second behind. The readouts come
from the `vehicles` entry with `current === true`. While `inVehicle` is true
but no current entry has arrived yet, the HUD renders with its readouts marked
unavailable rather than staying hidden.

### New subscription keys, not shared ones

`MapCanvas` owns `'map:position'` and `'map:vehicles'`, and SWR only ever runs
the first subscriber's handler per key. The HUD subscribes under its own keys —
`'driving:inVehicle'` and `'driving:vehicle'` — deriving exactly the state it
renders. The socket module replays the last snapshot per category on subscribe,
so a HUD that mounts mid-drive fills in immediately instead of waiting for the
next tick.

### Staleness is detected in the HUD, from arrival time

The handler stamps `Date.now()` when a `vehicles` message arrives. The HUD runs
a 1s interval while visible and treats readings older than a few times the
expected interval as stale, dimming them. This mirrors how `useServerConnection`
already notices a silent mod — absence of messages is only observable on a
timer.

### Two toggles, deliberately

- **Settings toggle** (`pz-dashboard.drivingHud`, default `true`, in the map
  section): governs whether the HUD may appear at all. Default on because the
  HUD is invisible on foot, so it costs a non-driving player nothing.
- **Collapse control on the HUD itself** (`pz-dashboard.drivingHudCollapsed`,
  default `false`): shrinks to a speed-only strip. Persisted for the same
  reason the map keeps its zoom — a player who wants it small wants it small
  next drive too.

Both are `useLocalStorage`, which syncs every subscriber in the tab, so
Settings and the HUD stay in step without a provider.

Alternative considered: a single toggle. Rejected — reaching Settings while
driving means leaving the map screen mid-drive, which is the moment the player
least wants to navigate away.

### Mounted in `HudShell`, positioned in the existing inset system

The HUD goes in `HudShell.tsx` next to `ConditionCluster` so it survives
navigation, and is placed with the shell's `--hud-*-inset` variables and
`--hud-hotbar-inset` rather than hardcoded offsets, so it stays clear of the
vitals cluster, the nav rail/tab bar and the hotbar in both layouts as those
resize. It sets `pointerEvents` on its own box only, leaving the rest of the
map surface free for pan and zoom.

## Risks / Trade-offs

- **Per-tick cost of the part scan while driving** → `getPartCount()` is a few
  dozen parts and the scan runs at 0.5s, not per frame. If it shows up in
  practice, drop `worstPartCondition` and keep `engineCondition`, which is a
  single lookup; the spec's damage scenario is satisfied by either.
- **`vehicles` payload grows with every vehicle the player has driven**, and it
  now writes at 0.5s instead of 2s while driving → the telemetry itself is a
  fixed handful of scalars on one entry, but the whole tracked list is
  re-serialised each write. A long-running save with many tracked vehicles
  makes each write bigger. Mitigation if it bites: cap or prune
  `trackedVehicles`, which is a pre-existing concern this change makes more
  visible rather than one it introduces.
- **Readouts can disagree with the in-game gauge** (raw vs. fake-modified
  speed; fuel percentage vs. tank ratio while the engine is off) → documented
  above as a deliberate choice; if it reads as a bug in play, multiplying by
  `BaseVehicle.getFakeSpeedModifier()` on the web side is a one-line change.
- **Screen real estate on mobile** → the map is the point of the Home screen,
  and a driving HUD covers part of it. The collapse control is the mitigation,
  and its state persists.
- **Build 42 renames a vehicle getter** → every call is wrapped in `safe()`, so
  a rename degrades one readout to "unavailable" and logs a `failed:` line in
  `console.txt` rather than killing the collector.

## Migration Plan

No data migration. Deployment is the normal mod flow: edit under `mod/`,
`bun scripts/deploy-mod.ts`, then reload Lua in-game. The new fields are
additive and optional in `VehicleSnapshot`, so a dashboard build ahead of the
deployed mod shows the HUD with unavailable readouts rather than failing, and a
mod build ahead of the dashboard publishes fields nothing reads. Rollback is
reverting the commit; nothing persisted changes shape, and the two new
localStorage keys are simply ignored if the feature is removed.
