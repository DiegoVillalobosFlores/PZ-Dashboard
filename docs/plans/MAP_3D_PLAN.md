# Plan: a 3D version of the map

Goal: a second, opt-in rendering of the Home screen map where the vanilla
worldmap polygons are extruded into a tilted, orbitable 3D scene — buildings
as blocks standing on the ground plane, the player marker in the middle,
everything else (fog, pins, route, labels) still readable.

The existing 2D `MapCanvas.tsx` stays exactly as it is and stays the default.
3D is a sibling component behind a setting, not a replacement, because it is
the one that can fall over on a low-power handheld.

## What we have today

- `server/src/map/vectorMap.ts` parses `media/maps/<region>/worldmap.xml`
  into `PolygonFeature[]` — a `FeatureCategory` plus a world-space
  `[x, y][]` ring per feature. Served from
  `/api/map/:region/features?x1&y1&x2&y2` and fetched by
  `queryVectorMap()` in `src/web/lib/vectorMap.ts`.
- `MapCanvas.tsx` renders those polygons as an SVG whose `viewBox` is in
  world squares, on top of `FogOverlay`, plus place/street labels,
  annotations, the vehicle pin, mock POI pins, the route line, and the eased
  player marker. Pan/zoom/pinch are hand-rolled pointer handlers.
- `three@0.185` is already a dependency (`CharacterModel.tsx`), and its
  `examples/jsm` bundle — `OrbitControls`, `BufferGeometryUtils` — is
  installed alongside it. **No new dependency is needed for any phase of
  this plan.**
- `CharacterModel.tsx` already establishes the project's three.js pattern:
  imperative scene/camera/renderer built in an effect, rAF loop, resize
  handling, explicit dispose on unmount.

**Consequence for heights:** `worldmap.xml` carries no elevation and no floor
count. `categoryFromProperties()` only ever recovers the building *type*
(`building-Residential`, `building-Industrial`, …). So there is no real
height data to read in v1 — building height is a per-category constant,
tuned by eye, kept in one editable table. Actual per-cell floor counts do
exist in the game files (`media/maps/<region>/*.lotheader`), but reaching
them is a new binary parser on the server; that is Phase 5 and only worth
doing if the heuristic visibly reads wrong.

## Phase 1 — the scene

New file `server/src/web/components/MapCanvas3D.tsx` (~250 lines). Nothing
else changes; no server work.

- Mount pattern copied from `CharacterModel.tsx` — same imperative
  scene/renderer/rAF/dispose shape. Deliberately duplicated rather than
  abstracted into a shared "three canvas" wrapper: two call sites with
  different cameras, lights and controls do not justify the indirection.
- Data comes from the existing `queryVectorMap()` with no server change.
  The query box is roughly twice the 2D one, since a tilted camera sees
  further than the nominal zoom span.
- **Ground** (water, roads, railway): `THREE.Shape` per polygon →
  `ShapeGeometry`, merged **per category** with `mergeGeometries` so the
  whole ground is ~7 draw calls instead of thousands of meshes. Fills come
  from the existing `FEATURE_COLOR` table (vanilla palette preserved),
  `MeshBasicMaterial`. Layering uses small `y` offsets (~0.01 apart) in
  `DRAW_ORDER` sequence — cheaper than fighting depth-buffer artifacts with
  `polygonOffset`.
- **Buildings:** `ExtrudeGeometry(shape, { depth: BUILDING_HEIGHT[category],
  bevelEnabled: false })`, again merged per category,
  `MeshLambertMaterial` lit by one `DirectionalLight` plus an
  `AmbientLight`. `BUILDING_HEIGHT` is a plain `Record<FeatureCategory,
  number>` in world squares — the calibration knob for this whole feature.
  Starting values to tune from: residential 6, hospitality/retail 8,
  industrial 11, medical 9, generic `building` 6.
- **Camera:** `PerspectiveCamera` + `OrbitControls` with
  `screenSpacePanning = true`, `maxPolarAngle ≈ 1.2` rad so the camera can
  never dip below the ground plane, and `target` following the eased player
  point. Using `OrbitControls` is the point of the phase — pan, orbit, tilt
  and pinch-zoom for free instead of a second hand-rolled gesture layer.
- **Player marker:** a cone at the controls target, yawed by the same
  heading math `MapCanvas.tsx` already computes from `position.dirX/dirY`.
- Small shared refactor: move `useSmoothedPoint` out of `MapCanvas.tsx`
  into `src/web/lib/mapFocus.ts` and import it from both components, so
  the marker eases identically in 2D and 3D.

## Phase 2 — overlays and interaction

- Pins, the vehicle marker, annotations, and place/street labels stay as
  the existing JSX/SVG markers in an absolutely-positioned HTML layer,
  repositioned each frame with `camera.project(worldVec)`. This reuses the
  markers already written instead of re-authoring each one as a canvas
  texture on a `THREE.Sprite`.
- Click-to-route: raycast the pointer against the ground plane to get a
  world point, then feed the existing `queryRoute()` unchanged. The result
  draws as a `THREE.Line` at `y = 0.5`. The
  `CLICK_MOVE_THRESHOLD_PX` drag-vs-click discrimination from
  `MapCanvas.tsx` carries over as-is.
- `useMapFocus` drives `controls.target`, so "focus this annotation" works
  the same in both views.

## Phase 3 — fog of war

One plane above the scene using a `CanvasTexture` as its alpha map: one
pixel per fog unit, painted directly from the `FogSnapshot` hex bitmask
(`fog.cells`). Linear texture filtering gives the soft edge for free, so
neither the SVG `feGaussianBlur` nor `knownRects()`' run-length rects need a
3D equivalent. Renders nothing until the mod sends a fog snapshot, matching
`FogOverlay`'s behavior against older mods.

## Phase 4 — the toggle

- `useMap3D()` in `src/web/lib/settings.ts`, mirroring the existing
  `useFogOfWar()` (Mantine `useLocalStorage`, no provider).
- A switch on the Settings screen.
- `HudShell.tsx` picks `MapCanvas` or `MapCanvas3D`. 2D remains the default,
  so it is also the fallback when 3D is too heavy on the Ayaneo.

## Phase 5 (only if needed) — real building heights

If the per-category constants read wrong, parse `media/maps/<region>/
*.lotheader` on the server for actual level counts and attach a height to
each building feature in the `/features` response. New server module, new
binary format, and a cache — meaningfully more work than everything above,
which is why it is last and conditional.

## Check

`src/web/lib/map3d.test.ts` (asserts only, no framework, in the style of
`fog.test.ts`): polygon → `THREE.Shape` conversion preserves winding and
vertex count, and `BUILDING_HEIGHT` covers every `FeatureCategory`.

## Known ceilings

- `MAX_ZOOM_SQUARES` is 2200 in 2D; extruding that much geometry is not
  viable, so the 3D view caps view distance around 800 squares.
- Geometry rebuilds on pan/zoom are debounced, and old merged geometries are
  disposed before the new ones are added.
- Not in scope: shadows, raster tiles as a ground texture, per-floor
  interiors.
