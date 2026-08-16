## Context

See proposal.md — Why.

Grounding, from the installed game's own Lua (`$PZ_INSTALL_DIR/media/lua`, per the `pz-mod-server` skill — these method names are confirmed present in this build, not recalled):

- `getClimateManager()` exposes `getDayLightStrength()`, `getNightStrength()`, `getPrecipitationIntensity()`, `getSnowStrength()`, `getFogIntensity()`, `getCloudIntensity()`, `getDesaturation()`, `getGlobalLight()`, `getWindPower()`, `getSeason()`, `getSeasonName()`, `getWeatherPeriod()`, `getThunderStorm()`.
- `RainManager.isRaining()` exists as a plain boolean.
- The `status` collector already holds `local climate = getClimateManager()` and uses it for `temperature`, and already runs at 1s.

On the dashboard side: `MapCanvas` renders a container `div` holding the `<svg>` (basemap, fog sheet, annotations, vehicle, route, player marker) followed by the recenter and clear-route buttons. `HudShell` layers the pill, nav rail and hotbar above it at `zIndex: 2`.

## Goals / Non-Goals

**Goals:**

- Use the game's own light model rather than reimplementing one.
- Cost nothing on the map's hot path: the map pans, zooms and eases the player marker continuously, including on the Ayaneo handheld layout.
- Degrade to "no tint" on every failure, never to "dark".

**Non-Goals:**

- Weather readouts or icons in the HUD; per-square or indoor lighting; animated precipitation.

## Decisions

**Take daylight from the game, not from the clock.**
`status` already carries `hour` and `minute`, so the tint could be computed from time of day with no mod change at all. Rejected: the game's daylight already accounts for season, latitude-ish curve and weather darkening, and a hand-rolled sunrise curve would drift from what the player sees on the other screen — which is the entire point of the feature. `getDayLightStrength()` is one `safe()` call in a collector that already has the climate manager open.

**A tinted overlay element, not a CSS `filter` on the SVG.**
`filter: brightness() saturate()` on the `<svg>` is a shorter diff and can desaturate, which an alpha overlay cannot. Rejected on performance: a filter forces the whole vector map to re-rasterize, and this map re-renders on every rAF while the player marker eases. A plain semi-transparent overlay is GPU-composited and costs nothing per frame. Desaturation is dropped as a result — colour and darkness carry the weather adequately.

**Place the overlay inside `MapCanvas`, immediately after `</svg>` and before the map buttons, with `pointerEvents: 'none'`.**
DOM order gives the result the spec asks for for free: the overlay covers the map and the fog sheet, the recenter and clear-route buttons that follow it stay untinted, and everything `HudShell` layers above at `zIndex: 2` is unaffected. `pointerEvents: 'none'` keeps pan, zoom and double-tap-to-route working through it.

**A pure `mapTint(status)` function in `server/src/web/lib/`, returning one CSS colour.**
Keeps the arithmetic — clamping, weighting, the legibility cap, snow versus rain — out of the component and under a unit test, following `fog.ts` / `fog.test.ts`. The component reads one string.

**Compose three contributions, then cap.**
Darkness from `1 - dayLight` toward a deep desaturated blue; weather from `precipitation` toward grey, shifted paler when `snow > 0`; fog from `fogIntensity` toward off-white. Total alpha is clamped to a legibility ceiling — the worst-case night thunderstorm must still show streets and labels. The ceiling is a named constant, tuned once against a real night in game, not derived.

**Snow is detected by `getSnowStrength() > 0`, not by a precipitation-type getter.**
The UI translation keys mention `PrecipitationIsSnow`, but no such getter appears in the game's Lua, and the skill's standing rule is not to guess API surface. `getSnowStrength()` is confirmed and answers the same question.

**Failure defaults are the *clear* values, not zero.**
`safe()` returns its default when a getter throws, and every numeric field in this collector defaults to `0` today. For daylight that is exactly backwards: a broken getter would report permanent midnight and black out the map — the skill's documented "silent wrong-zero" failure, in its most visible form. So `dayLight` defaults to `1`, and `precipitation`, `snow` and `fogIntensity` default to `0`. Every default means "clear daylight".

**Climate fields are optional in `StatusSnapshot`, and absence means no tint.**
The dashboard can be newer than the deployed mod — the two are deployed by separate steps (`bun scripts/deploy-mod.ts` plus a Lua reload). Optional fields plus a missing-means-clear rule make that combination render correctly instead of dark.

**CSS transition, not interpolation in JS.**
Status arrives once a second; a `transition` on the overlay's background carries it across smoothly for one style property, with no timer, no rAF, and no extra re-render.

## Risks / Trade-offs

- [The value ranges are assumed, not verified] → `getDayLightStrength()` and friends are assumed to be 0..1. This is unverified against a running game, so the implementation clamps every input and the task list requires observing the real values across a night and a storm before the tint curve is tuned.
- [Silent wrong-zero data] → A climate getter that does not exist on this build returns the `safe()` default and looks like plausible weather. Cross-check `console.txt` for `[PZDashboard] status.<field> failed:` lines before accepting the values, per the skill; do not treat a plausible-looking tint as proof.
- [Tint fights the fog-of-war sheet] → Both darken, and fog of war is on by default, so the night cap has to be tuned with fog of war on, not off.
- [Night makes the map genuinely less useful] → The cap plus the off switch. If the cap turns out to be too strong in play, it is one constant.
- [Colour choice and contrast] → The tint must not push the map below usable contrast for the route line or the player marker; check both at maximum tint rather than only the basemap.

## Migration Plan

Additive on both sides and independently deployable: the dashboard renders untinted against the current mod, and the extra status fields are ignored by a dashboard without this change. Rollback is reverting the overlay; the collector fields are inert on their own.
