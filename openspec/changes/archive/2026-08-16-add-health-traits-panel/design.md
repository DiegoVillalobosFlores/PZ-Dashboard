## Context

See proposal.md — Why. Facts checked against the live install that shape the
approach:

- Categories are fully generic. `PZDashboard_Categories.lua` is a plain list of
  `{ id, optionName, intervalOption, defaultInterval, maxInterval, label }`;
  `PZDashboard_Options.lua` and `PZDashboard_Main.lua` both iterate it, and
  `server/src/state/watcher.ts` derives the category from the JSON filename.
  A new category is one row plus one `PZDashboard.Collectors.<id>` function —
  no server change.
- Build 42 exposes traits through `CharacterTraitDefinition`:
  `player:getCharacterTraits():getKnownTraits()` yields trait types,
  `CharacterTraitDefinition.getCharacterTraitDefinition(type)` yields the
  definition with `getLabel()`, `getDescription()`, `getTexture()`,
  `getCost()`, `isProfessionTrait()` and `getXpBoosts()` (a Java map that needs
  `transformIntoKahluaTable`, values are `Integer`, so `:intValue()`). This is
  the same path `ISPlayerStatsUI.loadTraits` and
  `CharacterCreationProfession:checkXPBoost` use.
- Trait icons are already reachable. `renderIcon("trait_athletic")` resolves
  against the indexed texture packs (verified: `trait_athletic` and
  `trait_brave` both hit), so `/game-icons/<name>.png` serves them with no new
  route. The 16 loose PNGs in `media/ui/Traits/` are a subset of what the packs
  hold.
- `EquipmentPanel.tsx` already branches on `compact`: a column stack for
  mobile, a row with the model in the middle for wide. The traits list slots
  into that existing branch.

## Goals / Non-Goals

**Goals:**

- Traits stream through the same mechanism as every other category, so the
  manifest, options screen and reconnect replay work with no special cases.
- Effects come from game data, not from a table this repo maintains.
- The traits list does not disturb the existing paperdoll layout or the
  CharacterModel's size, drag behavior or WebGL context.

**Non-Goals:**

- No hand-authored effect descriptions for traits the engine hardcodes
  (Thick Skinned, Fast Healer, …). Their effect text is the game's own
  description, clamped.
- No trait editing/removal actions over the command channel. Read-only.
- No trait icons for mods whose textures live outside the vanilla packs — those
  fall back to label-only rows.

## Decisions

**Effects = XP boost chips, falling back to a clamped description line.**
`getXpBoosts()` is the only machine-readable effect the game exposes. Chips
(`Axe +2`) are precise and compact; for boost-less traits the honest fallback is
the game's own prose, clamped to one line with `-webkit-line-clamp: 1`, with the
full text still in the hover tooltip. Alternative considered and rejected: a
curated effects table in `lib/traits.ts` — richer, but it silently drifts every
time the game rebalances, and the dashboard would be confidently wrong.

**Icon name over icon bytes.** The collector reports
`trait:getTexture():getName()` and the frontend requests
`/game-icons/<name>.png`. Same shape as inventory item icons. Alternative:
base64 the PNG into the snapshot — bloats every tick's JSON for data that never
changes.

**Own category, slow interval.** `traits` gets its own row with a 10s default
interval (traits change at most a couple of times per run, via
`ISPlayerStatsUI`). Alternative: fold traits into the `skills` snapshot — would
force the trait payload through the 5s skills tick and muddy a snapshot the
Skills screen owns.

**`TraitsList` as a sibling inside `EquipmentPanel`, not a new panel.** The
user asked for the list to the left of the character. That means it must live
inside the panel that owns the paperdoll row, so it shares the same glass
frame. The wide branch becomes `[traits column][model][slots]` sized so the
model keeps its current `maxModelWidth`; the compact branch inserts the list
above the model. The list gets its own `useGameSubscription('traits', …)` —
consistent with the project's rule that state lives with the component that
renders it.

**Hover via Mantine `Tooltip`.** Already a dependency, handles focus and
portal-based positioning (no reflow), and `events={{ hover: true, focus: true,
touch: true }}` covers the pointer, keyboard and touch scenarios in the spec in
one prop. Alternative: `title` attribute — no touch support, no styling, slow
to appear.

**Ordering: beneficial first.** Sort by `cost` descending (positive-cost traits
are the good ones in PZ's economy), tie-broken by label, so the list reads the
same way every session rather than in the engine's arbitrary iteration order.

## Risks / Trade-offs

- **A trait's texture name does not resolve in the texture packs (mods)** →
  `/game-icons` 404s; the row renders label + effects with a neutral fallback
  glyph, never a broken image.
- **XP-boost-less traits show a truncated sentence, which reads as less
  informative than a real effect line** → accepted per the chosen option; the
  full text is one hover away, and it is never wrong.
- **The wide layout gets crowded on the narrower Ayaneo width** → the traits
  column takes a fixed narrow width with internal scroll and the model keeps
  its current width; if it still crowds, the column collapses to icon-only
  rows (tooltip still carries everything).
- **A long trait list overflows the panel height** → the column scrolls
  independently; the panel height stays as it is today.
- **Someone "simplifies" the category row away or renames the id** → the
  frontend subscription key and the mod filename must stay `traits`; the
  watcher matches on filename.

## Migration Plan

1. Mod changes, then `bun scripts/deploy-mod.ts` from the repo root.
2. Reload Lua in game (F11 > Lua Debug > Reload Lua) or reload the save — the
   copy alone does not reload Lua.
3. Verify `PZDashboard_traits.json` appears in `PZ_LUA_DIR` and that
   `/api/state/traits` returns it.
4. Rollback is dropping the category row; older dashboards ignore an unknown
   category, and an older mod just means the Health screen shows the waiting
   message.
