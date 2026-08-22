## 1. Setting

- [ ] 1.1 Add `coordinates: boolean` to `ClusterStatSettings` in `packages/web/lib/settings.ts` and set it to `true` in `DEFAULT_CLUSTER_SETTINGS`.

## 2. Readout

- [ ] 2.1 In `packages/web/components/ConditionCluster.tsx`, derive the displayed coordinates from the existing `map:position` subscription: `Math.floor` of `x` and `y`, and `z` only when it is not 0.
- [ ] 2.2 Render the coordinates as a span inside the existing `worldStats` group, using the same mono font and compact/wide sizing as the neighbouring time and temperature spans, gated on `settings.coordinates ?? DEFAULT_CLUSTER_SETTINGS.coordinates`.
- [ ] 2.3 Render nothing for the coordinates when no position has been received, leaving the rest of the world-stats strip untouched.

## 3. Settings screen

- [ ] 3.1 In `packages/web/screens/SettingsScreen.tsx`, add a "Coordinates" entry to `CLUSTER_STATS` so it renders as a `SettingRow` disabled with the rest of the cluster, with a hint naming what it shows.
- [ ] 3.2 Pass `checked` through the same nullish-coalesced default used in 2.2 so a pre-existing stored settings object does not render the switch as uncontrolled.

## 4. Verify

- [ ] 4.1 With the server running and the mod connected, confirm the readout matches the character's position, steps as they walk, and stays on the character when the map is panned away.
- [ ] 4.2 Confirm the toggle hides and shows the readout immediately and survives a reload, and that turning the condition cluster off hides the readout and disables its row.
- [ ] 4.3 Confirm the readout appears for a browser profile that already has a `pz-dashboard.conditionCluster` value stored from before this change.
- [ ] 4.4 Check the compact mobile layout at 390x844 for the added span, and the wide layout at 1620x1080.
