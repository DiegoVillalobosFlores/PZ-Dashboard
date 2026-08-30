## Why

While the player is driving, the dashboard shows the same HUD it shows on
foot: a map, vitals and a hotbar. None of the information that actually
matters behind the wheel — how fast the vehicle is going, how much fuel is
left, whether the engine is running, whether the headlights are on — is
available on the second screen, so the player has to look back at the game
window to read the vanilla dashboard. The mod already knows the player is in
a vehicle (`map.inVehicle`) and already publishes map position faster while
driving, so the trigger and the cadence exist; only the vehicle telemetry and
the readout are missing.

## What Changes

- The mod's `vehicles` collector gains driving telemetry for the vehicle the
  player is currently in: speed in km/h, fuel fraction and low-fuel state,
  engine running/started state, battery charge, headlight state, engine part
  condition, overall vehicle condition and the transmission gear letter.
  These are read through the same getters the game's own
  `ISVehicleDashboard` uses, so the readouts match what the game shows.
- Because that telemetry is only useful at driving cadence, the `vehicles`
  category gains a `vehicleInterval` the same way `map` has one, so it
  samples fast while the player is driving and falls back to its slow
  default (2s) otherwise.
- A new driving HUD appears over the map while the player is in a vehicle and
  disappears when they leave it. It shows the vehicle name, a speed readout, a
  fuel gauge, and status indicators for engine, headlights, battery and
  damage.
- The HUD is toggleable two ways: a persisted Settings toggle under the map
  section that governs whether it may appear at all, and a tap/click on the
  HUD itself that collapses it to a minimal speed-only strip and expands it
  again, so it can be pushed out of the way mid-drive without opening
  Settings.
- The HUD is laid out for both the mobile and wide handheld layouts and does
  not steal map drag/pan gestures outside its own bounds.

Assumptions recorded here rather than blocking on: the readout set is
vanilla-dashboard parity (the panel the game itself shows while driving), and
the Settings toggle defaults to **on** since the HUD is only ever visible
while driving and so costs nothing on foot.

## Capabilities

### New Capabilities

- `driving-hud`: what the dashboard displays while the player is in a
  vehicle, when that display appears and disappears, how the player toggles
  and collapses it, and what the mod must publish for it.

### Modified Capabilities

- `settings-screen`: the "Defaults unchanged" scenario enumerates every
  setting's default value, so adding the driving HUD toggle changes that
  requirement's expected state.

## Impact

- `mod/PZDashboard/42/media/lua/client/PZDashboard/PZDashboard_Collectors.lua`
  — `vehicles` collector gains the telemetry fields for the current vehicle.
- `mod/PZDashboard/42/media/lua/shared/PZDashboard/PZDashboard_Categories.lua`
  — `vehicles` gains `vehicleInterval`; the sandbox/mod-option interval
  bounds for that category follow.
- `packages/web/lib/liveTypes.ts` — `VehicleSnapshot` gains the telemetry
  fields, all optional so an older mod build still parses.
- `packages/web/components/` — new driving HUD component, mounted from
  `HudShell.tsx` so it survives navigation between screens like the rest of
  the shell.
- `packages/web/lib/settings.ts` and `packages/web/screens/SettingsScreen.tsx`
  — new persisted toggle in the map section.
- No server changes: `vehicles` already flows through the existing watcher,
  `/api/state` and `/ws` untouched.
