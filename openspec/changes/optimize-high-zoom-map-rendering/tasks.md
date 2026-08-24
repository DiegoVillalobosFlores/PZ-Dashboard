## 1. Baseline And Tile Alignment

- [ ] 1.1 Add a repeatable map benchmark runner or documented runner that drives `1280`, `2560`, `5120`, and `12000` world-square views at `1620x1080` and `390x844`, with live WebSocket traffic enabled.
- [ ] 1.2 Record baseline returned bytes, feature and label counts, SVG node counts, settle time, frame intervals, and overlay-enabled results from the current renderer.
- [ ] 1.3 Compare raster tile landmarks with vector geometry and live player coordinates for each tile-capable region; record alignment tolerance and failure cases.
- [ ] 1.4 Decide whether existing `locate` and region metadata are sufficient for tile placement or add an additive server-owned affine transform field before renderer integration.

## 2. Tile Data And Layout

- [ ] 2.1 Implement pure client helpers for selecting an available tile level, calculating viewport tile coverage, and positioning tiles in world coordinates.
- [ ] 2.2 Add bounded tile loading with request deduplication, a small prefetch margin, stale-request cancellation, and reuse while `MapCanvas` remains mounted.
- [ ] 2.3 Render a lower-resolution ancestor or previously loaded tile while the selected tile level is loading, without blanking the map.
- [ ] 2.4 Add cache headers for immutable map tile responses and any required additive region metadata response fields.
- [ ] 2.5 Add unit coverage for tile level selection, viewport coverage, world placement, cache behavior, and missing-tile handling.

## 3. Map Renderer Refactor

- [ ] 3.1 Split static base-map content, zoom-dependent labels, and live overlays into independently reusable render units.
- [ ] 3.2 Precompute vector polygon geometry only when source data changes so label sizing and camera updates do not rebuild polygon point strings.
- [ ] 3.3 Add adaptive base selection that keeps vector rendering for close and medium views and uses raster tiles at the benchmarked broad-view threshold.
- [ ] 3.4 Apply one shared world-coordinate camera transform to raster tiles and the overlay layer, preserving zoom anchoring, panning, recentering, and map focus.
- [ ] 3.5 Keep player and vehicle markers, annotations, route, destination state, and fog of war above the selected base without rebuilding unrelated base content on live updates.

## 4. Compatibility And Fallback

- [ ] 4.1 Detect missing tile imagery, missing metadata, unsupported regions, and tile-load failures without interrupting map rendering.
- [ ] 4.2 Fall back to the existing vector path while preserving current region content and interactions.
- [ ] 4.3 Benchmark the vector fallback; add bounded geometry reduction or viewport indexing only if fallback behavior violates the responsiveness contract.
- [ ] 4.4 Verify tile/vector transitions do not change live overlay alignment or destination coordinate semantics.

## 5. Verification

- [ ] 5.1 Test broad-view zoom and pan behavior at both reference viewport sizes, including non-center zoom anchoring and recentering.
- [ ] 5.2 Test live position updates, route rendering, annotations, vehicle state, fog enabled/disabled, and absent overlay categories over both base paths.
- [ ] 5.3 Run the complete benchmark matrix and verify the settle-time, task-duration, frame-p95, and long-frame budgets in `high-zoom-map-rendering`.
- [ ] 5.4 Compare representative screenshots and stable landmarks against the current vector renderer for visual coverage, tile alignment, labels, and overlay layering.
- [ ] 5.5 Run `bun test` and the server/browser build commands; confirm no mod or WebSocket schema changes are required.
