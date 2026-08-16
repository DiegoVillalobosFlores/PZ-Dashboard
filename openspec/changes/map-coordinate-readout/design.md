## Context

See proposal.md — Why.

Two facts about the existing code shape this design:

- `ConditionCluster` already subscribes to `map:position` (for the in-vehicle chip) and already renders a mono "world stats" strip of hour/minute, day, date and temperature, in both a compact mobile row and a wide stacked pill. The coordinate readout is the same kind of value in the same visual register.
- HUD preferences live in `server/src/web/lib/settings.ts` as Mantine `useLocalStorage` hooks. `useConditionClusterSettings` stores one object under `pz-dashboard.conditionCluster`, and `SettingsScreen` renders a `SettingRow` per key with `disabled={!settings.showCluster}`.

## Goals / Non-Goals

**Goals:**

- Reuse the existing position subscription, pill and settings object; add no new WebSocket key, no new component file, no mod or server work.
- Behave correctly for users who already have a stored settings object from before this change.

**Non-Goals:**

- Any coordinate other than the player's own (see proposal Non-goals).
- Making the readout survive the condition cluster being switched off.

## Decisions

**Render inside `ConditionCluster`'s world-stats strip, not as a standalone map overlay.**
The component already has the position value, the responsive compact/wide split, the glass pill and a settings object. A standalone pill in `MapCanvas` would need its own placement negotiated against the nav rail, hotbar, recenter and clear-route buttons in two layouts, for the same three lines of output. Trade-off accepted: coordinates inherit the cluster's master toggle, so hiding the cluster hides them. If the readout later needs to be independent, moving it out is a small, self-contained change.

**Store the flag in `ConditionClusterSettings`, not as a new top-level `useLocalStorage` hook.**
It is scoped to the cluster and is disabled with the rest of the cluster's rows, so it belongs in the same object. `useFogOfWar` stays the model for genuinely independent settings.

**Read the flag through the defaults: `settings.coordinates ?? DEFAULT_CLUSTER_SETTINGS.coordinates`.**
Mantine's `useLocalStorage` returns the stored value as-is and does not merge missing keys into the default object. Every existing user has a stored `pz-dashboard.conditionCluster` without a `coordinates` key, so reading `settings.coordinates` directly would be `undefined` — falsy — and the feature would ship invisible for exactly the people already using the dashboard, while looking correct on a fresh profile. The same applies to the Settings screen's `checked` prop, which would otherwise flip the switch from uncontrolled to controlled on first click and log a React warning.

Alternative considered: write a merged object back to storage on mount. Rejected — a migration write for one boolean, when the nullish coalesce is one operator at each of two call sites.

**Floor rather than round the position.**
`x`/`y` arrive as floats; the world square you are standing on is the floor of that value, which is what the game's own debug readout and every external Muldraugh map use. Rounding would name the neighbouring square for half of each square's width.

**Show `Z` only when non-zero.**
Most play is at ground level, where a constant `Z 0` is noise in a strip that is already dense on mobile.

## Risks / Trade-offs

- [Cluster toggle hides coordinates] → Documented in the spec as intended behaviour; the toggle row is disabled so it is visible why.
- [Mobile compact row is horizontally scrollable and already busy] → The readout joins the existing world-stats group rather than adding a new divider group, so it adds one span, not a new section.
- [Position updates at 0.5s and the marker eases per rAF] → Read the raw subscription value, not the eased/smoothed point, so the digits step once per fix instead of churning every frame.

## Migration Plan

None. Front-end only, no persisted-data format change beyond the additive key handled above; rollback is reverting the three files.
