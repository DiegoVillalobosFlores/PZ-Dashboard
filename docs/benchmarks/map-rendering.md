# Map Rendering Benchmark

Run against a server connected to the live game so the browser keeps its WebSocket state stream active:

```sh
MAP_BENCHMARK_URL=http://localhost:3000/ MAP_BENCHMARK_OUTPUT=map-benchmark.json MAP_BENCHMARK_QUIET=1 bun run map:benchmark
```

The runner launches headless Chromium, applies `1620x1080` and `390x844` device metrics, enables the live page transport, and drives `1280`, `2560`, `5120`, and `12000` world-square views. Each view runs with fog enabled and disabled. Set `MAP_BENCHMARK_CDP_URL` to reuse an existing CDP browser, or set `CHROMIUM` when Chromium is not on `PATH`.

Run `MAP_BENCHMARK_BLOCK_TILES=1` for the same matrix with tile URLs blocked; this exercises vector fallback and records its settle and frame budgets.

Vector fallback keeps exact polygon coordinates but aggregates each feature category into one SVG path. This bounds fallback DOM work even when a broad viewport contains the full region.

Each result records returned map bytes, vector feature and label counts, SVG node count, tile count, selected base, fallback state, settle time, all sampled frame intervals, raw frame p95, long tasks over 100 ms, frames over 33 ms and 100 ms, budget failures, and automated non-center zoom-anchor, pan, and recenter checks. `frameP95WithinBudget` allows 0.2 ms compositor-clock jitter around the 16.7 ms nominal cadence; raw p95 remains in output.

Overlay fields record fog state, annotation count, vehicle visibility, route visibility, and destination visibility. With live game traffic, use those fields while checking map, annotation, vehicles, fog, and command-driven route updates in both vector and raster cases; missing categories must remain absent without changing base selection.

Set `MAP_BENCHMARK_SCREENSHOT_DIR=map-benchmark-shots` to capture one PNG per matrix case for visual and landmark comparison.

## Baseline

The original vector renderer measurements captured before this change were:

| World squares | Polygon features | Settled frame data |
| ---: | ---: | --- |
| 1280 | 717 | Part of reported 280 ms to 1.44 s settle range |
| 2560 | 2560 | Part of reported 280 ms to 1.44 s settle range |
| 5120 | 7355 | Part of reported 280 ms to 1.44 s settle range |
| 12000 | 13725 | 10.05 ms average, 22.9 ms p95, 9/120 frames over 20 ms |

The broadest vector response was approximately 2.0 MB. The benchmark runner supplies missing per-case label, SVG-node, byte, and overlay measurements on every subsequent run instead of estimating them from feature counts.

## Latest Matrix

The live server matrix completed 16 cases with tile imagery enabled. Values below show both overlay states where they differ materially:

| Viewport | World squares | Base | Tiles | Returned bytes | Settle ms | Raw frame p95 | SVG nodes |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1620x1080 | 5120 | raster | 55 | 5.9 MB | 128 | 16.8 ms | 935 fog / 61 clear |
| 1620x1080 | 12000 | raster | 74 | 6.6 MB | 143 | 16.7 ms | 1549 fog / 71 clear |
| 390x844 | 5120 | raster | 18 | 1.7 MB | 127 | 16.7 ms | 898 fog / 25 clear |
| 390x844 | 12000 | raster | 28 | 2.3 MB | 141 | 16.7 ms | 1503 fog / 37 clear |

Blocked-tile fallback matrix completed 16 cases with vector base in every case. Maximum settle was `272 ms`; maximum raw p95 was `16.8 ms`; no sampled frame exceeded `33 ms`, no long task exceeded `100 ms`, and all interaction probes passed.

## Alignment

Map metadata returns `worldToPixel` beside `zoomLevels`. It is an additive server-owned affine transform with separate X/Y scale and origin. Tile placement uses that transform for both tile bounds and live overlay coordinates; browser code contains no region calibration constants. A region without transform metadata, empty coverage, or a failed tile request stays on vector rendering.

Run the measurement with:

```sh
PZ_INSTALL_DIR=/path/to/ProjectZomboid bun run map:alignment
```

`scripts/map-alignment.ts` correlates the two assets over the whole region rather than at one landmark. The paper map draws roads in a rust red nothing else on the parchment uses, and `worldmap.xml` carries the same roads in world squares, so the transform that maximises red-ink overlap is the map's true registration. It then refits the origin per quadrant; the spread of those refits is the alignment tolerance a single affine can deliver.

Measured for `Muldraugh, KY` on a 2560x2176 probe grid at 4 zoom-0 pixels per cell, against 2858 vector road features:

| Transform | scaleX | scaleY | origin | Road overlap |
| --- | ---: | ---: | ---: | ---: |
| chance floor (road ink density) | | | | 3.8% |
| earlier single-landmark calibration | 0.49409 | 0.47501 | 0,0 | 5.5% |
| measured fit | 0.5 | 0.5 | 122,123 | 43.3% |

The fit is unambiguous: one zoom-0 pixel is exactly two world squares, offset by the map art's border. The earlier calibration scored barely above chance and has been replaced. Per-quadrant refits land within **2 zoom-0 pixels (4 world squares)** of the global fit, so a single affine covers the region and no per-area correction is needed.

`docs/benchmarks/alignment-probe-roads.png` is the visual confirmation: vector road geometry drawn in cyan over the raster base at a `12000` world-square view, tracing the drawn roads through Muldraugh, Rosewood, Echo Creek, Irvington, March Ridge and Doe Valley.

Two gotchas the measurement exposed, both now covered by tests:

- A zoom level halves the whole pixel grid, **origin included**. `tileWorldRect`, `calculateViewportTileCoverage` and `worldToTile` divided only the scale, which is invisible while the origin is `0` and shifts every tile by `originX * (2^zoom - 1)` world squares once it is not.
- Region metadata is served with immutable cache headers, so a browser holding an older `worldToPixel` keeps using it until a hard reload.

Switching between raster and vector preserves the camera exactly: zooming from `12000` (raster) to `5000` (vector) moved the viewBox from `2208.49 5275.12 12000` to `5708.49 8775.12 5000`, both centred on `8208.49, 11275.12`.

### Known fallback limitation

`docs/benchmarks/alignment-vector-5000.png` shows the vector base just under the raster threshold. Street labels scale with the view (`labelSize = zoomSquares / 34`) but are never thinned by count, so a broad vector view is buried in overlapping road names. This is the pre-existing vector behaviour the fallback is contracted to preserve, not a regression from raster rendering, and it is why the raster base takes over at `5120`. Thinning broad-view labels is a separate change.

## Budgets

- Broad view at `5120` world squares settles within `1000 ms`.
- Maximum view at `12000` world squares settles within `1500 ms`.
- Maximum-view settled frame p95 is at most `16.7 ms`.
- Maximum-view sampled frame interval stays at or below `33 ms`.
