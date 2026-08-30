## 1. Mod telemetry

- [ ] 1.1 In `PZDashboard_Collectors.lua`, extend the loop that clears
  `current` on every tracked vehicle so it also nils the telemetry fields, so a
  parked vehicle never carries stale readings
- [ ] 1.2 On the entry marked `current`, collect the telemetry listed in
  design.md via the existing `safe()` wrapper: `speedKmh`, `gear`,
  `engineRunning`, `engineStarted`, `keysInIgnition`, `fuelPercent`, `battery`,
  `headlightsOn`, `engineCondition`
- [ ] 1.3 Add `worstPartCondition` as a single pass over
  `getPartByIndex(0..getPartCount()-1)` reducing to the minimum condition, the
  whole loop inside one `safe()` call
- [ ] 1.4 Add `vehicleInterval = 0.5` to the `vehicles` row in
  `PZDashboard_Categories.lua`
- [ ] 1.5 Deploy with `bun scripts/deploy-mod.ts`, reload Lua, and verify
  against a real drive: the published `vehicles` snapshot carries telemetry on
  the current vehicle, `console.txt` shows no `failed:` lines for the category,
  and the fields disappear on foot

## 2. Dashboard types and settings

- [ ] 2.1 Add the telemetry fields to `VehicleSnapshot` in
  `packages/web/lib/liveTypes.ts`, all optional
- [ ] 2.2 Add `useDrivingHud` (`pz-dashboard.drivingHud`, default `true`) and
  `useDrivingHudCollapsed` (`pz-dashboard.drivingHudCollapsed`, default
  `false`) to `packages/web/lib/settings.ts` alongside the existing hooks
- [ ] 2.3 Add the driving HUD toggle to the map section of
  `SettingsScreen.tsx`, with a description that matches on the text filter, and
  wire it into that section's reset and the reset-all path
- [ ] 2.4 Extend `packages/web/lib/settings.test.ts` to cover the new defaults

## 3. Driving HUD component

- [ ] 3.1 Create the HUD component subscribing under its own keys —
  `'driving:inVehicle'` off `map` and `'driving:vehicle'` off the `vehicles`
  entry with `current === true`, stamping arrival time in the handler
- [ ] 3.2 Render the readouts: vehicle name, speed with unit, fuel, and engine,
  headlight, battery and damage indicators, each showing "unavailable" when its
  field is absent rather than rendering a zero
- [ ] 3.3 Emphasise the fuel readout below the level the game itself warns at,
  and dim all readings once the arrival stamp is older than several times the
  expected interval
- [ ] 3.4 Add the collapse control: collapsed shows speed only, expanded shows
  everything, state read from and written to the persisted setting
- [ ] 3.5 Return nothing when the setting is off or the player is not in a
  vehicle
- [ ] 3.6 Add a unit test for the pure parts — deriving the current vehicle
  from a `vehicles` snapshot, the low-fuel threshold, and the staleness cutoff

## 4. Shell integration and layout

- [ ] 4.1 Mount the HUD in `HudShell.tsx` so it survives navigation between
  screens
- [ ] 4.2 Position it with the shell's `--hud-*-inset` and
  `--hud-hotbar-inset` variables so it clears the vitals cluster, the nav rail
  or bottom tab bar, and the hotbar in both the mobile and wide layouts
- [ ] 4.3 Confine `pointerEvents` to the HUD's own box so map pan and zoom
  outside it are unaffected

## 5. Verification

- [ ] 5.1 Run the web test suite and typecheck
- [ ] 5.2 Drive in-game and check both layouts (mobile 390x844 and Ayaneo
  1620x1080): the HUD appears on entering a vehicle, tracks speed and fuel,
  survives navigating to another screen and back, collapses and expands, and
  disappears on exit
- [ ] 5.3 Confirm turning the Settings toggle off hides it mid-drive and back
  on restores it without a reload
- [ ] 5.4 Run `openspec validate driving-hud --strict`
