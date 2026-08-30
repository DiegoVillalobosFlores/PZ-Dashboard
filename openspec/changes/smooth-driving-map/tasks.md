## 1. Mod: vehicle sampling cadence

- [ ] 1.1 Add a `vehicleInterval` field (`0.1`) to the `map` entry in `PZDashboard_Categories.lua`
- [ ] 1.2 In `PZDashboard_Main.lua`'s tick, use `vehicleInterval` when the category defines one, the player is in a vehicle, and the configured interval still equals the category default
- [ ] 1.3 Deploy with `bun scripts/deploy-mod.ts`, reload Lua, and confirm `PZDashboard_map.json` mtime advances ~10x per second while driving and returns to the on-foot rate on exit

## 2. Server: poll floor

- [ ] 2.1 Lower `POLL_INTERVAL_MS` to `100` in `packages/core/config.ts`
- [ ] 2.2 Confirm `/ws` delivers map fixes at the faster cadence while driving and that existing watcher tests still pass

## 3. Client: fixed-lag interpolation

- [ ] 3.1 Extract the marker motion math into a pure helper (given the last two fixes, their arrival times, the smoothed fix interval and `now`, return the interpolated point or a snap)
- [ ] 3.2 Cover the helper with a unit test: steady motion is evenly spaced, a gap over the snap threshold snaps, a stale feed holds at the newest fix
- [ ] 3.3 Rewrite `useSmoothedPoint` in `MapCanvas.tsx` to drive that helper on rAF, tracking fix arrival times and the EWMA fix interval, keeping the current signature so the direction-vector caller is unaffected
- [ ] 3.4 Verify the player marker and heading stay smooth on foot and while driving, and that the marker settles when the player stops

## 4. Client: speed-based auto zoom

- [ ] 4.1 Add a `useAutoZoomOnSpeed` hook to `packages/web/lib/settings.ts` following the `useFogOfWar` pattern, defaulting to off
- [ ] 4.2 Add the toggle to the Settings screen alongside the other map settings
- [ ] 4.3 In `MapCanvas.tsx`, derive speed from the interpolator's fix-to-fix displacement and widen to the travel zoom above the threshold, restoring the pre-auto zoom below it
- [ ] 4.4 Suppress auto zoom for the rest of the trip once the player pans or zooms manually
- [ ] 4.5 Verify all four spec scenarios by driving: enabled/fast, enabled/slowing, disabled, and manual zoom during auto zoom

## 5. Wrap-up

- [ ] 5.1 Run the repo's typecheck and test commands
- [ ] 5.2 Note the new `POLL_INTERVAL_MS` and the vehicle cadence rule wherever the mod's intervals are documented
