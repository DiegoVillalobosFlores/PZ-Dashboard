## Purpose

Keeps broad map views usable when the dashboard displays much more world area, without sacrificing live overlays, map interactions, or support for regions that lack optimized imagery.

## ADDED Requirements

### Requirement: Broad map views remain responsive

The dashboard SHALL render a usable broad map view without a single map update blocking input for more than 100 ms.

#### Scenario: Broad view at reference wide viewport

- **WHEN** the map is changed to show `5120` world squares or more at a `1620x1080` viewport
- **THEN** the base map becomes usable within 1 second
- **AND** no individual map-update task blocks input for more than 100 ms

#### Scenario: Maximum supported broad view

- **WHEN** the map is changed to show `12000` world squares at a `1620x1080` viewport
- **THEN** the base map becomes usable within 1.5 seconds
- **AND** the settled 120-frame sample has a p95 frame interval no greater than 16.7 ms
- **AND** no sampled frame interval exceeds 33 ms

### Requirement: Map interactions remain continuous

The dashboard SHALL preserve panning, zoom anchoring, recentering, map focus, and destination selection at broad map views without changing their coordinate semantics.

#### Scenario: Pan at broad view

- **WHEN** the user pans the map while showing a broad view
- **THEN** the map follows the pointer continuously
- **AND** the player, route, vehicle, annotation, and fog coordinates remain aligned with the same world positions

#### Scenario: Zoom around an anchor

- **WHEN** the user zooms at a point that is not the viewport center
- **THEN** that world point remains under the same screen position, subject to existing map bounds and rounding behavior

### Requirement: Live overlays retain priority

The dashboard SHALL keep player and vehicle markers, annotations, route state, fog of war, and destination interactions live and visually above the optimized base map.

#### Scenario: Live position update over broad base

- **WHEN** the game sends a new player position while a broad map view is displayed
- **THEN** the player marker updates without rebuilding or replacing unrelated base-map content

#### Scenario: Overlay data is unavailable

- **WHEN** an overlay category has not been received or is disabled
- **THEN** the base map still renders
- **AND** the missing overlay remains absent rather than preventing map rendering

### Requirement: Optimized rendering has a compatible fallback

The dashboard SHALL render a usable base map when optimized imagery, geometry, or region metadata is unavailable.

#### Scenario: Raster or reduced-data path unavailable

- **WHEN** the optimized broad-view resource cannot be loaded for the selected region
- **THEN** the dashboard falls back to its supported vector map path
- **AND** panning and zooming remain available

#### Scenario: Existing map region remains supported

- **WHEN** the user opens a region supported by the current map API but not by the optimized path
- **THEN** the dashboard preserves current map content and interactions for that region

### Requirement: Performance remains measurable

The project SHALL provide repeatable map benchmarks for `1620x1080` and `390x844` viewports that record returned data size, rendered node or tile count, map-settle time, frame intervals, and fallback behavior at representative broad-view levels.

#### Scenario: Benchmark covers broad-view levels

- **WHEN** the map benchmark runs
- **THEN** it records results for at least `1280`, `2560`, `5120`, and `12000` world squares
- **AND** it records both reference viewport sizes
- **AND** it reports failures against the responsiveness budgets
