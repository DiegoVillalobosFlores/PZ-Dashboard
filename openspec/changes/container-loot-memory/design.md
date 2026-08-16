## Context

See proposal.md — Why.

What already exists, and what this design leans on:

- `PZDashboard.Containers.enumerate` returns one record per container with `id`, `kind`, `name`, `type`, `icon`, `x`, `y`, `z`, `locked` and the container handle. The `containers` collector forwards all of that plus `weight`, `capacity` and the full item list, every 2s by default (`PZDashboard_Categories.lua`).
- Positions are already there: object, corpse and floor-bag records carry the square they were found on; carried containers carry the player's square.
- `server/src/state/store.ts` is an in-memory `Map` of the latest snapshot per category, with `onCategoryUpdate(listener)` already used by `index.ts` to publish over WebSocket. A second listener is the natural insertion point.
- `MapCanvas` already re-queries the server when the view leaves a padded bounding box (`fetchCenter` / `padding`, around line 358), and `mapFocus.focusMap` already exists for centring the map from elsewhere in the app.
- `AnnotationsDrawer` is the established pattern for a right-edge map drawer opened from a `HudIconButton` in `HudShell`.
- The collector's `SCAN_RADIUS` is 1, so only the 3x3 squares around the player are scanned.

## Goals / Non-Goals

**Goals:**

- Persist sightings without touching the live container path — no change to container ids, item moving, or the `containers` snapshot shape.
- Survive `bun build --compile`, which the current branch ships.
- Keep two saves' memories strictly apart.

**Non-Goals:**

- Collector hardening (scan radius, item stacking, payload size). Deferred by decision; see Risks for what that costs this feature.
- Any in-game write-back.

## Decisions

**Derive the memory key server-side; leave the mod's container ids alone.**
The mod's world-container id is `obj:<x>:<y>:<z>:<index>`, where `index` is the position in `square:getObjects()`. That is fine for its actual job — a key that round-trips within one enumerate/act cycle — but it is not stable across time: add or remove anything on that square and the index shifts, so a persisted store keyed on it would silently attribute one container's contents to another.

The fix does not need to be in Lua. The snapshot already carries `x`, `y`, `z` and the container `type`, so the server can compute its own key: `<x>:<y>:<z>:<type>:<ordinal among same-type containers on that square, in snapshot order>`. That is stable under exactly the churn that breaks the raw index, needs no mod change, and leaves `moveItems` and pane selection untouched.

Alternative considered: change the id format in `PZDashboard_Containers.lua`. Rejected — same key, but with a blast radius across `PZDashboard_Actions.moveItems` and the container pane, for no gain, since nothing but the memory needs the id to outlive a single snapshot.

**Scope by save, and refuse to write when the save is unknown.**
Nothing in the current stream identifies the save, so two characters would merge into one memory — the single worst failure this feature could have, because it is invisible and irreversible. The mod adds `save` and `region` to the `status` collector (`getWorld():getWorld()` and `getWorld():getMap()`); the memory writer reads the last `status` snapshot out of the store when a `containers` snapshot arrives, and drops the write if the save is missing or empty. This is the one place not to be lazy: dropping a few sightings after startup is cheap, merging two saves is not.

`status` is the right home over a new category — it already carries the day/hour the memory wants to stamp sightings with, so one store read gets both.

**`bun:sqlite`, not a JSON file.**
It ships with the runtime (no new dependency), it is supported under `bun build --compile`, it writes incrementally instead of rewriting the whole memory every 2s, and it answers "which containers hold something matching 'gas'" without loading every sighting into memory. Two tables: one row per container (key, save, kind, name, type, x, y, z, locked, last-seen day/hour/wall-clock) and one row per remembered item (container key, name, type, count), with an index on item name and on `(save, x, y)`.

Alternative considered: one table with contents as a JSON column, filtered in JS. Rejected — the item search is the point of the feature, and it would mean reading every row of a save to answer one query.

**Database path next to the executable, not in the cache directory.**
`MAP_CACHE_DIR` is derivable data and safe to delete; this is not. New `PZ_MEMORY_DB` config defaulting to `join(APP_DIR, "data", "containers.sqlite")`, reusing the existing `APP_DIR` handling that already distinguishes a compiled binary from a source checkout.

**Replace contents wholesale per sighting, and skip unchanged ones.**
The player is standing next to the container when it is reported, so the report is authoritative — merging would keep ghost loot after the crate is emptied. To avoid rewriting rows every 2s while the player stands still, the writer keeps a per-key signature of the last contents written (sorted item ids) in memory and skips the transaction when it is unchanged. Signature only, not the contents: the point is to avoid disk churn, not to hold a second copy of the memory in RAM.

**Remember world containers only.**
`object`, `floorBag`, `floor` and `deadBody` are recorded. `player` and `bag` move with the character, so their position is meaningless as a memory. `vehicle` moves too and already has a live map layer of its own.

**Stamp the in-game day, not just wall-clock time.**
"Seen on day 12" is what a player can reason about; wall-clock time is stored as well, only for ordering results.

**Read over plain HTTP, not the WebSocket.**
The memory is pull-shaped — a search, or a bounding-box query on pan. The socket is for pushed game state. Map pins reuse the padded-bounding-box refetch `MapCanvas` already does for vector features.

## Risks / Trade-offs

- [`SCAN_RADIUS = 1` bounds the whole feature] → The memory only fills for containers the player walked within one square of, so a room cleared from the doorway is remembered thinly. This is the largest limitation and it is accepted for now; widening the radius is the deferred collector change, and it improves this feature without changing its design.
- [A remembered container is destroyed, dismantled or burned] → The pin goes stale silently. Mitigated by showing the sighting day on every pin and result, a per-container forget, and self-correction the next time the player walks past.
- [Two same-type containers on one square, one of which is later removed] → The surviving container inherits the removed one's ordinal and therefore its record. Rare, self-correcting on the next sighting, and preferable to the raw-index key it replaces.
- [Memory growth] → One row per container ever visited plus its items; a long save is tens of thousands of rows, which SQLite does not notice. No retention policy, only manual forget.
- [Multiplayer] → Another player emptying a remembered container is invisible until you walk past it. Documented, not solved.
- [Search results reveal what the player looted, on a shared screen] → No mitigation needed; it is the player's own history.

## Migration Plan

Additive. First run creates the database; no existing data to migrate. Rollback is deleting the database file and reverting the routes — the live dashboard does not depend on the memory being present, and every read path must tolerate an empty or missing database.
