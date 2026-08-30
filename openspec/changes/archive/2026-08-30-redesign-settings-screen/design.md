## Context

See `proposal.md` — Why. Relevant current state:

- `packages/web/screens/SettingsScreen.tsx` renders a `ScreenModal` >
  `GlassPanel` with a hardcoded `width: 420` and a single scrolling `div`. Rows
  are two local components (`SettingRow`, `SectionLabel`) plus one hand-rolled
  copy of `SettingRow` for the fog-of-war tile.
- `packages/web/lib/settings.ts` exposes one `useLocalStorage` hook per setting.
  Defaults are inline literals in each hook except the condition cluster, which
  already exports `DEFAULT_CLUSTER_SETTINGS`. Mantine's `useLocalStorage` syncs
  every subscriber in the tab, which is how the map and this screen agree
  without a provider.
- The rest of the app treats `min-width: 900px` as the mobile/handheld
  breakpoint (`HomeScreen`, `HealthScreen`, `SkillsScreen`, `InventoryScreen`,
  `ScreenModal`).
- Project rule: no code comments.

## Goals / Non-Goals

**Goals:**

- One declarative description of the settings — section, title, hint, current
  value, setter, default — that the section rendering, the filter and the reset
  actions all read from, so adding a setting means adding one entry.
- Keep every localStorage key and default byte-identical to today.

**Non-Goals:**

- No settings context/provider, no reducer, no settings schema abstraction
  beyond a plain array. The `useLocalStorage`-per-setting pattern stays.
- No persistence of the filter text or of scroll position.
- No animation or transition work beyond what Mantine's `Switch` already does.
- No new dependency. Mantine (`TextInput`, `Switch`, `Button`,
  `useMediaQuery`) and React are enough.

## Decisions

**A settings descriptor array built inside the component, not a module-level
config.** Each entry is `{ id, section, title, hint, checked, onChange,
disabled?, reset }`. The hooks must be called at the top of `SettingsScreen`
(rules of hooks), so the array is assembled there from their results rather
than declared at module scope. Section metadata (`id`, `label`, order) is a
module-level constant since it needs no hook.

Alternative rejected: a module-level registry mapping setting id to a hook, and
calling hooks in a loop. It would let other screens enumerate settings, but
calling hooks from a loop over a config is fragile and nothing else needs the
enumeration today.

**Defaults move to exported constants in `settings.ts`.** Reset needs the same
default the hook uses; duplicating literals in the screen would let them drift.
Export a `DEFAULT_*` constant per setting (matching the existing
`DEFAULT_CLUSTER_SETTINGS`) and have each hook's `defaultValue` reference it.
This is the only change to `settings.ts`.

Alternative rejected: reset by removing the localStorage key. Mantine's
`useLocalStorage` does not re-read on removal from the same tab, so the UI
would not update until reload — this fails the "reflected immediately"
scenario.

**Filter is a plain `useState` string matched case-insensitively against
`title + hint`.** Sections render only when at least one of their settings
matches; when nothing matches at all, render an empty-state line. The condition
stat toggles are part of the same array (section `conditions`), so they filter
like any other row — a search for "panic" surfaces just that toggle. The
"cluster hidden means stat toggles disabled" rule stays a `disabled` flag on
those entries, independent of filtering.

**Reset is derived from the same array.** Section reset calls `reset()` on each
entry in that section; reset-all calls it on every entry. No separate list of
defaults to keep in sync. The cluster's `showCluster` and its eleven stats all
live in one stored object, so their `reset()` implementations each write one
field of `DEFAULT_CLUSTER_SETTINGS` — correct under repeated calls and under a
single-row reset from a filtered view.

Reset-all gets a confirmation step (a second click on a "Confirm" state, not a
modal — the panel is already a modal and nesting one is worse) because it is
destructive of user configuration and trivially misclicked next to the filter.
Per-section reset is narrow enough to apply directly.

**Layout: keep `ScreenModal` and `GlassPanel` untouched.** Replace the fixed
`width: 420` with a width that depends on `useMediaQuery('(min-width: 900px)')`
— the same breakpoint the other screens use — and lay the sections out with
`display: grid` and `gridTemplateColumns` of one column on mobile, two on wide.
The filter field and reset-all sit in a non-scrolling header above the
scrolling section grid, so the existing `minHeight: 0` / `overflowY: auto`
arrangement inside `GlassPanel` keeps working (that nested-height subtlety is
documented in `ScreenModal.tsx` and is easy to break).

**Row styling: one `SettingRow` for every row.** Today fog-of-war is a
one-off tile. Give every row the `var(--color-tile-bg)` treatment with
consistent padding, and drop the bespoke copy. Sections get a `SectionHeader`
carrying the label and the section reset control, replacing `SectionLabel`.

**Section assignment:**

| Section | Settings |
| --- | --- |
| Map | Fog of war, Auto zoom while driving |
| Character | Character rotation |
| Skills | Skills summary, Traits list |
| Conditions | Conditions cluster + the 11 stat toggles |

The stat toggles keep their existing Vitals/Conditions subgrouping as
subheadings inside the Conditions section.

## Risks / Trade-offs

- Two-column layout on the handheld width could place a section's rows across
  a column break awkwardly → sections are grid items, so a section never
  splits; the Conditions section spans both columns given it holds twelve rows.
- Exporting defaults and referencing them from the hooks touches the module
  every other screen imports → the change is mechanical (literal moves to a
  `const` above the hook) and the values are asserted by a test.
- Filtering hides the cluster parent toggle while showing a disabled stat
  toggle, with no visible reason for the disabled state → the stat rows keep a
  hint explaining they follow the cluster toggle.
- Reset-all's confirm-on-second-click can be left mid-state if the user moves
  away → it reverts to its idle label on blur and after a few seconds.

## Migration Plan

No data migration: keys and defaults are unchanged, so existing stored
preferences load as-is. The change is confined to two frontend files; rollback
is reverting them.
