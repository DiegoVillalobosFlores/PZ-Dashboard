## Why

The Settings screen has grown into a single flat scroll of seventeen switches
in a fixed 420px modal, with eleven of them being the condition-cluster stat
toggles. There is no grouping beyond two inline "Vitals"/"Conditions" labels,
no way to find a setting without scrolling past everything, and no way to undo
an experiment short of flipping switches back one by one. Every new preference
the dashboard adds makes that worse, so the screen needs structure before more
settings land on it.

## What Changes

- Reorganize the settings into named sections that match where the setting
  takes effect — Map, Character, Skills, Conditions — instead of one
  undifferentiated list. The condition stat toggles become a nested part of
  the Conditions section rather than trailing rows.
- Restyle the screen to the floating-glass HUD language: section headers,
  tile-backed rows with consistent padding, and a single visual treatment for
  every row (today the "Fog of war" row is a one-off tile while the rest are
  bare labels).
- Add a search/filter field that narrows visible rows by setting title and
  hint text, hiding sections that end up empty.
- Add "reset to defaults" — one global action, plus a per-section action —
  that restores the affected settings to their documented default values.
- Make the modal responsive inside its existing `ScreenModal` frame: a single
  column on mobile widths, a wider multi-column section layout on the Ayaneo
  handheld width. It stays a modal at every size.
- Keep every existing setting, its localStorage key, and its default value
  unchanged, so the redesign changes presentation and control, not behavior of
  the settings themselves.

## Capabilities

### New Capabilities
- `settings-screen`: how the dashboard presents, groups, searches and resets
  user preferences, and the responsive behavior of the settings modal.

### Modified Capabilities

None. No existing spec under `openspec/specs/` describes the Settings screen;
the settings that other capabilities depend on (fog of war, auto-zoom,
character rotation, traits/summary visibility, condition cluster) keep their
current keys, defaults and effects.

## Impact

- `packages/web/screens/SettingsScreen.tsx` — rewritten around sections,
  search and reset.
- `packages/web/lib/settings.ts` — needs exported default values for the
  settings that currently inline their defaults in the hook call, so reset has
  a single source of truth.
- No change to `packages/web/components/ScreenModal.tsx`, the route in
  `packages/web/App.tsx`, the mod, the server, or any consumer of the settings
  hooks.
