## Why

The `containers` collector already reports every nearby container with its world position, name, lock state and full contents — and the server throws all of it away every 2 seconds, keeping only the latest snapshot. So the dashboard can tell you what is in the crate you are standing next to, and nothing about the twelve houses you cleared yesterday.

Remembering those sightings turns the map into something the game itself cannot do: a searchable record of where you saw what. "Which house had the gas cans", "where did I leave the spare sledgehammer", "did I already loot this row of shops". It is also honest — the record only ever contains containers the character physically stood next to, so it adds no information the player did not earn.

## What Changes

- The server persists every world container sighting to a local SQLite database: position, kind, name, lock state, contents, and the in-game day the sighting happened.
- Sightings are scoped to the save they came from. The mod starts reporting the current save (and map region) so two characters never share one memory.
- A sighting replaces the previous record for that container wholesale, so looting a crate empty is remembered as empty rather than leaving ghost contents behind.
- Only world containers are remembered — world objects, dropped bags, floor piles and corpses. The player's own inventory, carried bags and vehicle containers are not: they move with you, and vehicles already have their own live map layer.
- New read API: query remembered containers by item text and/or by map bounding box, and forget a single container or a whole save.
- The map gains a remembered-container layer, off by default, toggled from Settings next to fog of war.
- A map drawer searches the memory by item name; picking a result focuses the map on that container.
- Container identity for the memory is derived server-side from the snapshot's position and container type. The mod's live container ids stay exactly as they are, so item moving and pane selection are untouched.

## Capabilities

### New Capabilities

- `container-memory`: recording what was in each world container when the character last stood next to it, scoped per save, and querying that record by item or by map area.

### Modified Capabilities

(none — no existing specs)

## Impact

- `mod/.../PZDashboard_Collectors.lua` — the `status` collector gains `save` and `region` string fields. No change to the `containers` collector or to `PZDashboard_Containers.lua`.
- `server/src/state/` — new memory module (`bun:sqlite`), subscribed to container snapshots through the existing `onCategoryUpdate` listener.
- `server/src/config.ts` — database path, with an env override.
- `server/src/index.ts` — new `/api/memory/containers` routes.
- `server/src/web/` — map layer, settings toggle, search drawer.
- No new npm dependency; `bun:sqlite` ships with the runtime and survives `bun build --compile`.

## Non-goals

- Widening the collector's scan radius, stacking duplicate items, or shrinking the snapshot payload. Those are real problems in the collector and they bound how much this feature can remember, but they are a separate change.
- Remembering containers the character has not stood next to, or anything the game knows and the player does not.
- Multiplayer correctness: another player emptying a container you remember will not be noticed until you walk past it again.
- Any write path back into the game (marking a container looted from the dashboard).
