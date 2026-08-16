## Why

The dashboard knows the player's exact world position — it streams it every 0.5s and eases the marker across the map — but never shows the numbers. Coordinates are what you paste into an online Muldraugh map, write down for a stash, or read out to someone else playing on the same save. The game itself only exposes them through the debug menu, so it stays behind a setting rather than being forced on.

## What Changes

- The condition cluster gains a coordinate readout alongside the existing time/day/temperature strip: the player's integer world square (`X 10682 Y 9432`), plus the `Z` level when the player is not on the ground floor.
- The readout follows the player, not the panned map view. Panning away does not change the numbers.
- A new "Coordinates" toggle in the Settings screen controls it, sitting with the other condition-cluster rows and disabled when the cluster itself is hidden.
- The toggle defaults to on, matching every other setting in `settings.ts`.
- Settings persisted before this change lack the new key, so the stored value is read through the defaults rather than used raw — otherwise existing users would silently get the "off" behaviour despite the default being on.

## Capabilities

### New Capabilities

- `map-coordinates`: displaying the player's live world coordinates on the HUD and letting the player turn that display off.

### Modified Capabilities

(none — no existing specs)

## Impact

- `server/src/web/lib/settings.ts` — one boolean added to `ConditionClusterSettings` and `DEFAULT_CLUSTER_SETTINGS`.
- `server/src/web/components/ConditionCluster.tsx` — renders the readout; already subscribes to `map:position` for the in-vehicle chip, so no new subscription and no new game data.
- `server/src/web/screens/SettingsScreen.tsx` — one `SettingRow`.
- No mod change, no server change, no new WebSocket category.

## Non-goals

- Coordinates for the panned map centre or for an arbitrary tapped square (a separate "tap a square" readout feature).
- A standalone coordinate pill independent of the condition cluster; hiding the cluster hides the coordinates too.
- Copy-to-clipboard on the readout.
