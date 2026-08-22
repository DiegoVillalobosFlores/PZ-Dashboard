## 1. Save identity from the mod

- [ ] 1.1 Add `save` and `region` string fields to `PZDashboard.Collectors.status` in `mod/.../PZDashboard_Collectors.lua`, from `getWorld():getWorld()` and `getWorld():getMap()`, wrapped in `safe` like every other field.
- [ ] 1.2 Add both fields to `StatusSnapshot` in `packages/web/lib/liveTypes.ts`.
- [ ] 1.3 Deploy with `bun scripts/deploy-mod.ts`, reload Lua, and confirm the values land in `PZDashboard_status.json` for a live save.

## 2. Memory store

- [ ] 2.1 Add `PZ_MEMORY_DB` to `apps/server/src/config.ts`, defaulting to `join(APP_DIR, "data", "containers.sqlite")`, creating the directory if missing.
- [ ] 2.2 Create `packages/core/state/memory.ts` opening the database with `bun:sqlite` and creating the two tables and their indexes on first use.
- [ ] 2.3 Implement the memory key: `<x>:<y>:<z>:<type>:<ordinal among same-type containers on that square, in snapshot order>`.
- [ ] 2.4 Implement `recordSighting(containersSnapshot, status)`: skip when the save is unknown or empty, keep only `object`, `floorBag`, `floor` and `deadBody` kinds, and upsert each container plus its items in one transaction, replacing previous items for that key.
- [ ] 2.5 Skip the write for a container whose contents signature is unchanged since the last write in this process.
- [ ] 2.6 Implement `searchContainers(save, text, limit)` and `containersInBounds(save, x1, y1, x2, y2)`, both ordered most-recently-seen first.
- [ ] 2.7 Implement `forgetContainer(save, key)` and `forgetSave(save)`.

## 3. Wiring

- [ ] 3.1 In `apps/server/src/index.ts`, subscribe a second `onCategoryUpdate` listener that calls `recordSighting` when the `containers` category updates, reading the latest `status` snapshot from the store for the save id and game day.
- [ ] 3.2 Add `GET /api/memory/containers` accepting either `q` (item text) or a bounding box, scoped to the save reported by the current `status` snapshot, returning an empty list when the save is unknown.
- [ ] 3.3 Add `DELETE /api/memory/containers/:key` and `DELETE /api/memory/containers` (whole current save).
- [ ] 3.4 Make every read path tolerate a missing or empty database rather than throwing.

## 4. Test

- [ ] 4.1 Add `server/src/state/memory.test.ts` against an in-memory database covering: key stability when a square's object order changes between snapshots, two same-type containers on one square staying distinct, contents being replaced rather than merged, an emptied container no longer matching a search for its old contents, and a snapshot with an unknown save writing nothing.

## 5. Map layer

- [ ] 5.1 Add a `useRememberedContainers` toggle to `packages/web/lib/settings.ts`, defaulting to `false`, alongside `useFogOfWar`.
- [ ] 5.2 Add its row to `SettingsScreen` next to fog of war.
- [ ] 5.3 In `packages/web/components/MapCanvas.tsx`, when the toggle is on, fetch remembered containers for the same padded bounding box already used for vector features, and refetch on the same condition.
- [ ] 5.4 Draw a marker per remembered container, with its name and last-seen day in the title, visible regardless of fog of war.

## 6. Search drawer

- [ ] 6.1 Add a memory search drawer modelled on `packages/web/components/AnnotationsDrawer.tsx`, with a text field querying `/api/memory/containers?q=`, listing container name, remembered matching items, position and last-seen day.
- [ ] 6.2 Open it from a `HudIconButton` in `packages/web/components/HudShell.tsx` next to the existing map-notes button.
- [ ] 6.3 Picking a result calls `focusMap` on the container's position and closes the drawer.
- [ ] 6.4 Show an explicit empty state for a search with no matches, and a forget control per result.

## 7. Verify

- [ ] 7.1 With a live game: stand next to a crate, confirm the sighting is recorded; take everything out, walk away and back, confirm it is remembered as empty.
- [ ] 7.2 Confirm walking a route records the containers passed and that returning to them updates rather than duplicates the pins.
- [ ] 7.3 Load a second save and confirm its map and search show none of the first save's containers.
- [ ] 7.4 Restart the server and confirm the memory survives; delete the database file and confirm the dashboard still runs and shows an empty memory.
- [ ] 7.5 Confirm the map layer is off by default, and that turning it on shows remembered pins inside fogged areas.
