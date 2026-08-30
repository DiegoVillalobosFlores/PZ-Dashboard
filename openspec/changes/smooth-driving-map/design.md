## Context

See proposal.md — Why. The relevant current state:

- The mod's `map` category publishes on a per-category interval slider
  (`PZDashboard_Categories.lua`, default `0.25`s, minimum `0.25`s) driven by
  `PZDashboard_Main.lua`'s `OnTick` loop. The snapshot already carries
  `inVehicle`.
- `packages/core/state/watcher.ts` polls the mod's folder every
  `POLL_INTERVAL_MS` (250ms, `packages/core/config.ts`) and pushes changed
  categories over `/ws`. This poll is a hard floor on delivery rate: writing
  map fixes faster than the poll buys nothing on its own.
- `useSmoothedPoint` (`packages/web/components/MapCanvas.tsx`) eases the
  marker toward the newest fix with a 120ms exponential time constant and
  snaps when the gap exceeds 40 squares. With a ~250-500ms effective fix
  interval, the ease is finished in roughly 300ms and the marker then dwells
  — the stutter this change targets.
- `manualCenter` overrides the followed center whenever the player pans or
  zooms, and the recenter button clears it. Settings are plain
  `useLocalStorage` hooks in `packages/web/lib/settings.ts`.

## Goals / Non-Goals

**Goals:**

- Marker motion that is frame-to-frame even across a whole fix interval at
  vehicle speed.
- Denser fixes while driving, without changing the on-foot write load or
  overriding a player who deliberately raised the interval slider.
- Auto zoom-out at speed that a player can turn off and that never fights
  manual camera control.

**Non-Goals:**

- Camera lead/offset toward the heading — explicitly declined.
- Predicting vehicle motion from acceleration or steering; a first-order
  velocity model is enough at these speeds.
- Changing base-map rendering, tiles, or the routing overlay.

## Decisions

### Fixed-lag interpolation, not extrapolation

Render the marker at `now - lag`, interpolating linearly between the two most
recent fixes, where `lag` is the measured recent fix interval (an EWMA over
the last few gaps, clamped to a sane range). Motion is then continuous by
construction across the entire interval, and every rendered position is one
the game actually reported.

Alternatives considered: (a) keep the exponential ease but lengthen the time
constant to match the fix interval — simpler, but an exponential still front-
loads motion, so it looks fast-then-slow rather than steady, and it lags
permanently behind at constant speed; (b) extrapolate ahead using the last
velocity — zero latency, but it overshoots every time the car stops or turns
and the correction is more visible than the lag it removes. Fixed-lag
interpolation costs one fix interval of latency, which at ~100-250ms is not
perceptible for navigation.

The existing snap threshold stays: a gap above `SNAP_DISTANCE_SQUARES` skips
interpolation entirely. If no fix has arrived for longer than the expected
interval plus a margin, the marker holds at the newest fix rather than
continuing to advance — the "fixes stop arriving" scenario.

This replaces `useSmoothedPoint`'s internals; the hook keeps its signature and
its second caller (the direction vector) keeps working unchanged, so heading
smoothing rides along with no separate handling.

### Vehicle cadence: speed up only when the player is at the default

In `PZDashboard_Main.lua`'s tick, when the category is `map` and
`player:getVehicle() ~= nil`, use a vehicle interval (`0.1`s) instead of the
configured one — but only when the configured value is still the category
default. A player who raised the slider did so for performance and gets what
they asked for; the "configured interval is respected" scenario covers this.

The category table gains a `vehicleInterval` field so the rule stays data-
driven rather than a special case keyed on the string `"map"`.

### Lower the server poll floor to match

Drop `POLL_INTERVAL_MS` to `100`. Without this the mod's faster writes are
invisible: the watcher would still deliver at most one map fix per 250ms.
The poll stats the mod's handful of files and reads only those whose mtime
changed, so the added cost is a directory listing plus stats at 10Hz.

Alternative considered: poll only `PZDashboard_map.json` faster and leave the
rest at 250ms. Rejected as premature — one interval is less code, and if the
10Hz listing shows up in profiles, splitting it is a contained follow-up.

### Auto zoom: a settings toggle plus a speed-derived zoom floor

A `useAutoZoomOnSpeed` hook in `settings.ts` mirroring `useFogOfWar`, surfaced
on the Settings screen next to the other map settings. Default off, so the
change does not alter the camera for anyone who doesn't opt in.

Speed comes from the same fix-to-fix displacement the interpolator already
computes, so no new mod field. Above a threshold the map widens to a fixed
"travel" zoom; below it, the zoom returns to the value in effect before auto
zoom engaged. Because `manualCenter`/manual zoom already take precedence in
`MapCanvas`, a manual gesture suppresses auto zoom for the rest of the trip
by clearing the remembered pre-auto zoom — a single guard rather than new
camera state.

## Risks / Trade-offs

- **One fix interval of added latency** → At the vehicle cadence this is
  ~100ms, far below the current stutter's perceived cost. Walking keeps its
  existing (larger) interval, where nothing about the perceived position
  changes because the old easing lagged by a comparable amount anyway.
- **10Hz directory polling on the server** → Same file count as today, only
  more often; reads still gated on mtime. Revisit by scoping the fast poll to
  the map file if it shows in a profile.
- **More writes to `PZDashboard_map.json` while driving** → Only while in a
  vehicle, only for players on the default slider, and the file is small. The
  interval slider remains the escape hatch.
- **Auto zoom fighting the player** → Mitigated by defaulting it off and by
  letting any manual gesture win for the remainder of the trip.
- **No test coverage on `MapCanvas`** → The interpolation math should land in
  a pure helper with a small unit test, so the fix-interval and snap logic is
  checkable without rendering the map.

## Migration Plan

Client changes ship with the app. Mod changes require
`bun scripts/deploy-mod.ts` and a Lua reload (F11 → Lua Debug → Reload Lua) or
a save reload. An old mod against the new client is fine — the client just
sees the on-foot cadence and interpolates over the longer interval. A new mod
against an old client is also fine: extra fixes, same easing as today.
