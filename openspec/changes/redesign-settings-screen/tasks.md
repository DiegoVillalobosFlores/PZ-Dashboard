## 1. Defaults as a single source of truth

- [x] 1.1 In `packages/web/lib/settings.ts`, lift each hook's inline
  `defaultValue` into an exported constant (`DEFAULT_FOG_OF_WAR`,
  `DEFAULT_SHOW_TRAITS`, `DEFAULT_SHOW_SUMMARY`, `DEFAULT_AUTO_ZOOM_ON_SPEED`,
  `DEFAULT_AUTO_ROTATE`) and have the hook reference it, leaving
  `DEFAULT_CLUSTER_SETTINGS` as is. Values must not change: fog of war,
  traits, summary and rotation stay `true`, auto zoom stays `false`.
- [x] 1.2 Add an exported pure `settingMatchesFilter(title, hint, filter)`
  helper in `packages/web/lib/settings.ts` implementing the
  case-insensitive title-or-hint match, with empty/whitespace filter matching
  everything.
- [x] 1.3 Add `packages/web/lib/settings.test.ts` (bun test, matching the
  existing `lib/*.test.ts` style) asserting the default values against the
  spec's "Defaults unchanged" scenario and covering
  `settingMatchesFilter`: match on title, match on hint, case-insensitive,
  empty filter matches, no-match.

## 2. Section and row structure

- [x] 2.1 In `packages/web/screens/SettingsScreen.tsx`, add a module-level
  `SECTIONS` constant listing section id, label and display order for Map,
  Character, Skills and Conditions.
- [x] 2.2 Build the settings descriptor array inside `SettingsScreen` from the
  hook results — one entry per setting with `id`, `section`, `title`, `hint`,
  `checked`, `onChange`, optional `disabled`, and `reset` — assigning sections
  per the design's table and keeping every existing title and hint.
- [x] 2.3 Fold the eleven condition stat toggles into the same array under the
  Conditions section, preserving their Vitals/Conditions subgrouping as a
  `subgroup` field and keeping `disabled` tied to `showCluster`.
- [x] 2.4 Replace the one-off fog-of-war tile markup with a normal
  `SettingRow`, and give `SettingRow` the tile background and consistent
  padding so every row renders identically.
- [x] 2.5 Replace `SectionLabel` with a `SectionHeader` that renders the
  section label and its reset control, and render subgroup labels inside the
  Conditions section.

## 3. Filter

- [x] 3.1 Add a Mantine `TextInput` filter field in a non-scrolling header
  area above the scrolling section grid, holding its value in `useState`.
- [x] 3.2 Filter the descriptor array through `settingMatchesFilter` and
  render only sections that still have at least one matching setting.
- [x] 3.3 Render an explicit "no settings match" line when the filter matches
  nothing, instead of an empty panel.
- [x] 3.4 Verify manually that toggling a row while a filter is active changes
  the setting and that clearing the filter restores every section in its
  original order.

## 4. Reset

- [x] 4.1 Give every descriptor entry a `reset()` that writes its default;
  for the cluster entries, write the corresponding field of
  `DEFAULT_CLUSTER_SETTINGS` through the functional `setSettings` updater so
  repeated and partial resets stay correct.
- [x] 4.2 Wire each `SectionHeader` reset control to call `reset()` on that
  section's entries only.
- [x] 4.3 Add the reset-all control beside the filter field, with a
  confirm-on-second-click state that reverts to idle on blur and after a short
  timeout.
- [x] 4.4 Verify manually that a reset immediately updates dependent UI (fog
  of war on the map, the condition cluster pill) and survives a reload.

## 5. Responsive layout

- [x] 5.1 Replace the fixed `width: 420` with a width driven by
  `useMediaQuery('(min-width: 900px)')`, matching the breakpoint the other
  screens use, keeping the panel inside `ScreenModal`/`GlassPanel` unchanged.
- [x] 5.2 Lay the sections out with `display: grid` — one column below the
  breakpoint, two above — with the Conditions section spanning both columns.
- [x] 5.3 Keep the filter/reset-all header fixed while the section grid
  scrolls, preserving the existing `minHeight: 0` / `overflowY: auto` chain so
  the panel still scrolls rather than clipping.

## 6. Verification

- [x] 6.1 Run the test suite and the type check; both must pass.
- [x] 6.2 Check the screen at mobile (390x844) and Ayaneo (1620x1080) widths:
  no horizontal scrolling, no clipped control, every section reachable.
- [x] 6.3 Confirm no code comments were added, per the project rule.
