## Why

The map is lit the same at 3am in a thunderstorm as at noon in July. The second screen sits next to a game whose whole mood is driven by light and weather, and it currently reads like a paper atlas that has no idea what is happening outside.

Tinting the map with the game's own light and precipitation values makes the companion screen feel like it is watching the same world — and carries real information, since "it is getting dark" and "a storm is rolling in" are both things a player acts on.

## What Changes

- The `status` collector reports four climate values it does not currently send: daylight strength, precipitation intensity, snow strength and fog intensity. `getClimateManager()` is already in hand there, so this is four more `safe()` calls in a collector that already runs every second.
- The map draws a tint overlay above the map and below the HUD: darker as daylight falls, greyer as precipitation rises, whiter as fog thickens, paler when the precipitation is snow.
- The tint is capped so the map never becomes unreadable, and never covers the vitals pill, nav rail, hotbar or map buttons.
- The tint transitions smoothly between the once-a-second status updates rather than stepping.
- A "Map tint" toggle in Settings, next to fog of war, defaults to on.
- Every climate field is optional end to end: a dashboard talking to an older deployed mod, or a failed getter, renders no tint rather than a black map.

## Capabilities

### New Capabilities

- `map-weather-tint`: reflecting the game's current light and weather on the map, under the player's control, without compromising the map's legibility.

### Modified Capabilities

(none — no existing specs)

## Impact

- `mod/.../PZDashboard_Collectors.lua` — four fields added to the `status` collector. No new category, no new interval, no new file.
- `server/src/web/lib/liveTypes.ts` — four optional fields on `StatusSnapshot`.
- `server/src/web/lib/` — new pure function mapping a status snapshot to a tint colour, with a unit test.
- `server/src/web/components/MapCanvas.tsx` — one overlay element.
- `server/src/web/lib/settings.ts`, `server/src/web/screens/SettingsScreen.tsx` — one toggle.

## Non-goals

- A weather readout in the conditions cluster (rain icon, wind speed, season). Wind and season are one getter each and can be added later; nothing renders them today, so nothing collects them here.
- Per-square lighting, indoor/outdoor distinction, or a moon phase.
- Applying the tint to anything but the map: the HUD stays at full contrast.
- Animating rain or snow on the map.
