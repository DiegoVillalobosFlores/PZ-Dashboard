## Why

While the player is walking, the mod's 0.25s position fixes and the map's
120ms exponential easing are close enough that the marker looks continuous.
In a vehicle the player covers far more ground between fixes, so the marker
sprints to the newly-reported position in roughly 300ms and then sits still
until the next fix arrives — a visible stutter of jump, dwell, jump, exactly
when the map matters most for navigation.

## What Changes

- The map marker follows a motion model instead of chasing the last fix: the
  client tracks the interval and displacement between consecutive fixes and
  renders continuous motion across the whole gap rather than converging early
  and dwelling.
- The mod's `map` collector samples faster while the player is in a vehicle,
  so the client has denser, fresher fixes to work from. Walking cadence is
  unchanged.
- A new toggleable setting auto-zooms the map out while the player is moving
  fast and restores the previous view when they slow down. Default state and
  the toggle live alongside the existing map settings.
- No change to camera lead/offset, manual pan/zoom precedence, or the
  recenter button behavior.

## Capabilities

### New Capabilities
- `live-map-motion`: How the dashboard turns discrete position fixes from the
  mod into continuous on-screen player motion, including vehicle sampling
  cadence and the speed-based auto-zoom setting.

### Modified Capabilities

<!-- None: high-zoom-map-rendering covers base-map rendering performance, which
     this change does not alter. -->

## Impact

- `packages/web/components/MapCanvas.tsx` — `useSmoothedPoint`, the smoothing
  constants, and the follow-center/zoom wiring.
- `packages/web/lib/settings.ts` and the Settings screen — new auto-zoom
  toggle following the existing `useLocalStorage` pattern.
- `mod/PZDashboard/42/media/lua/client/PZDashboard/PZDashboard_Main.lua` and
  `PZDashboard_Collectors.lua` — vehicle-aware sampling cadence for the `map`
  category. Requires redeploying the mod (`bun scripts/deploy-mod.ts`).
- Write volume to `<Zomboid>/Lua/PZDashboard_map.json` rises while driving;
  the server watcher poll (`PZ_POLL_MS`, default 250ms) becomes the limiting
  factor and may need to be considered.
