## Why

At 1620x1080 with live game data, widening the map viewport makes `MapCanvas` mount thousands of SVG nodes: `717` polygons at `zoomSquares=1280`, `2,560` at `2560`, `7,355` at `5120`, and `13,725` at `12000`. Clean browser measurements show settle time rising from `280 ms` to `1.06 s` to `1.44 s`; the `12000` case averages `10.05 ms` per frame with a `22.9 ms` p95 and 9 of 120 frames over 20 ms. The local API remains fast, but its response grows to about `2.0 MB`, so client rendering and DOM size are the limiting costs now.

## What Changes

- Add an adaptive high-zoom base-map rendering path that keeps map interaction responsive as visible world area grows.
- Reuse or reduce static map geometry instead of rebuilding every polygon and label on each high-zoom update; use the existing raster tile pyramid where it provides a better bounded-cost base layer.
- Keep live overlays and behavior intact: player and vehicle markers, annotations, route, fog of war, panning, zoom anchoring, recentering, and map focus.
- Add repeatable desktop and mobile benchmarks covering data size, node count, transition time, frame cadence, and visual parity at representative zoom levels.
- Define a fallback for unavailable tiles or unsupported regions so optimization never removes the usable vector map.

## Capabilities

### New Capabilities

- `high-zoom-map-rendering`: Render broad map views with bounded client work while preserving current map content and interactions.

### Modified Capabilities

(none)

## Impact

- `packages/web/components/MapCanvas.tsx` — base-map composition, zoom/data update path, and dynamic overlay layering.
- `packages/web/lib/mapTiles.ts` — client tile addressing if the raster path is selected.
- `packages/core/map/vectorMap.ts` — viewport query/indexing or geometry reduction if vector data remains part of the broad-view path.
- `packages/core/routes.ts` — map response behavior or cache headers if API changes are needed.
- `packages/core/map/tiles.ts` — existing raster pyramid metadata and tile serving, including coordinate calibration validation.
- New or expanded map tests and benchmark tooling; no mod or WebSocket schema change expected.
