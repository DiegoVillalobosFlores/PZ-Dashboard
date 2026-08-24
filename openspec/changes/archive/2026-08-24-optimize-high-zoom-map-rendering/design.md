## Context

See proposal.md - Why.

`MapCanvas` currently puts the complete queried vector base map, labels, fog mask, and live overlays in one SVG. The server caches the parsed world map, but each feature query still scans the parsed dataset. The existing tile API already extracts Project Zomboid's `spawnSelectImagePyramid.zip`, serves individual PNGs, and exposes region zoom metadata; its world-to-pixel calibration is currently approximate for the default region.

The map route stays mounted while screens change, so the renderer must preserve camera state and avoid replacing the map when unrelated HUD state updates. The benchmark environment is a live game/server pair, with reference viewports at `1620x1080` and `390x844`.

## Goals / Non-Goals

**Goals:**

- Bound broad-view base-map DOM and React work independently of visible feature count.
- Keep dynamic overlays in world coordinates and update them without rebuilding static base content.
- Preserve camera behavior, visual alignment, and existing region support.
- Make tile loading progressive, cacheable, and safe when requests fail.
- Establish repeatable performance and visual-parity checks before and after implementation.

**Non-Goals:**

- Changing the mod's streamed categories or WebSocket protocol.
- Replacing close-range vector rendering where its detail and exact world geometry are useful.
- Building a new map-data format or spatial database before client-side rendering costs are addressed.
- Adding map editing, search, or new map annotations.

## Decisions

### Use a hybrid base-map renderer

Keep the current vector base for close and medium views. Switch to the existing raster tile pyramid for broad views, initially around the `5120` world-square range where profiling shows the first severe render task. Select the available tile level from region metadata and viewport scale, and keep the switch threshold tunable until both reference viewports are benchmarked.

Raster tiles bound the base layer to the number of tiles covering the viewport instead of the number of world features. The vector path remains useful for exact close detail and provides the compatibility fallback.

Alternative: move all features to canvas. Rejected as the first approach because canvas would still require processing the full feature set at every broad-view update and would make labels, hit behavior, and visual fallback more complex. Replacing the map with raster tiles at every scale was also rejected because close vector detail and unsupported regions must remain available.

### Keep overlays in a separate world-coordinate layer

Render tiles below a lightweight overlay layer containing the player and vehicle markers, annotations, route, destination state, and fog of war. Apply the same camera transform to both layers. Dynamic position updates must change overlay state only; tile images and static vector geometry must not be recreated.

For the vector fallback, split static polygon geometry, zoom-dependent labels, and dynamic overlays into separately reusable render units. Precompute polygon point strings only when source geometry changes, not when label size or camera state changes.

Alternative: retain one SVG and rely on memoization around the parent. Rejected because large SVG child trees still incur broad commits and make dynamic updates share the base layer's invalidation cost.

### Derive tile placement from server-owned map metadata

Reuse the tile route, `locate` behavior, and available-level metadata. If the client needs an affine world-to-pixel transform or image bounds, extend the existing region metadata response with that data rather than duplicating calibration constants in the browser. Position tiles in the same world coordinate system used by overlays, with an ancestor or lower-resolution tile as a temporary placeholder while the selected level loads.

The default region's known calibration discrepancy must be measured against stable map landmarks before broad raster rendering becomes the default. Vector rendering remains the fallback when metadata is missing or alignment cannot be trusted.

Alternative: hardcode the current client-side calibration. Rejected because the existing calibration is explicitly approximate and would misalign live markers on some regions or map extents.

### Make tile requests bounded and cacheable

Compute only tiles intersecting the viewport plus a small prefetch margin, deduplicate requests, abort stale loads after a camera move, and retain loaded tiles while the map remains mounted. Mark static tile responses cacheable for repeat visits. Do not add a server spatial index in this change unless measurements show the vector fallback or tile metadata path needs it; current local feature-query timings are not the bottleneck.

### Validate with a browser benchmark matrix

Add a repeatable benchmark entry point or documented runner that drives the same camera transitions at `1280`, `2560`, `5120`, and `12000` world squares on both reference viewports. Record map-settle time, returned bytes, rendered SVG nodes or tile count, frame intervals, and fallback results. Run with live WebSocket traffic enabled, and capture separate cases with fog and overlays enabled so optimization does not hide an overlay-specific regression.

Use the current measurements as the baseline, but judge the implementation against the budgets in the capability spec. Include screenshot or landmark checks for tile/vector alignment, overlay layering, zoom anchoring, panning, recentering, and destination selection.

## Risks / Trade-offs

- [Raster imagery does not align with vector world coordinates] → Extend server-owned metadata, validate against known landmarks, and retain vector fallback until alignment passes.
- [Tile requests leave gaps during fast pan or zoom] → Keep the previous/ancestor tile visible, use a prefetch margin, cancel stale requests, and fall back to vector content on failure.
- [Fog masks or other overlays remain expensive at broad views] → Benchmark overlays separately and keep them isolated from the base layer so they can be optimized without reintroducing base-map work.
- [Raster artwork differs from the current vector palette] → Compare representative screenshots and keep vector rendering at scales where the difference harms detail or readability.
- [Unsupported regions have no calibrated tile metadata] → Detect capability per region and use the existing vector path without changing region selection behavior.
- [A large vector fallback still exceeds broad-view budgets] → Add bounded geometry reduction or server-side viewport indexing only after the fallback benchmark identifies the specific cost.

## Migration Plan

No persisted-data or mod migration is required. Ship the browser and server changes together so additive metadata and tile cache headers are available when the renderer switches. Rollback is reverting the renderer selection; the existing vector endpoint and tile endpoint remain usable independently.

## Open Questions

- Which exact `zoomSquares` threshold and tile pyramid level give best visual quality on both reference viewports? Tune from benchmark results without changing the capability contract.
- Does the current tile calibration need a new server metadata field, or can existing region metadata plus `locate` provide sufficient placement accuracy? Decide during the alignment test before wiring the broad-view switch.
