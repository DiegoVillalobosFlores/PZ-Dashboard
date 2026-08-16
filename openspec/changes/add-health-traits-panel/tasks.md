## 1. Mod: collect traits

- [x] 1.1 Add a `traits` row to `PZDashboard_Categories.lua` (`TraitsEnabled` /
      `TraitsInterval`, default 10.0, max 60, label "Traits")
- [x] 1.2 Add `PZDashboard.Collectors.traits(player)` in
      `PZDashboard_Collectors.lua`: iterate
      `player:getCharacterTraits():getKnownTraits()`, resolve each through
      `CharacterTraitDefinition.getCharacterTraitDefinition`, and emit
      `{ id, label, description, cost, profession, icon, xpBoosts }` with every
      game call wrapped in the existing `safe()` helper
- [x] 1.3 Build `xpBoosts` from `getXpBoosts()` via `transformIntoKahluaTable`,
      emitting `{ perk, perkName, level }` per entry
      (`PerkFactory.getPerkName(perk)`, `level:intValue()`)
- [x] 1.4 Derive `icon` from `trait:getTexture():getName()`, stripping any
      directory and `.png` suffix so it matches the `/game-icons/:name` route;
      empty string when the trait has no texture
- [ ] 1.5 Deploy (`bun scripts/deploy-mod.ts`), reload Lua, and confirm
      `PZDashboard_traits.json` lands in `PZ_LUA_DIR` with no errors in
      `console.txt`

## 2. Server / types

- [x] 2.1 Add `TraitXpBoostSnapshot`, `TraitSnapshot`, `TraitsSnapshot` and
      `CategoryMap.traits` to `server/src/web/lib/liveTypes.ts`
- [ ] 2.2 Confirm `/api/state/traits` and the `/ws` push both carry the new
      category with no server code change (watcher is filename-driven)
- [ ] 2.3 Confirm `/game-icons/<icon>.png` resolves for the icons the live
      character's traits report; note any that 404

## 3. Frontend: traits list

- [x] 3.1 Add `server/src/web/lib/traits.ts`: sort helper (cost descending,
      then label) and the effects derivation — XP boost chips when
      `xpBoosts.length > 0`, otherwise the clamped description line
- [x] 3.2 Add `TraitsList.tsx` with its own
      `useGameSubscription('traits', …)`, rendering per row: the game icon
      (`/game-icons/<icon>.png`, neutral fallback glyph on missing/error),
      the label, and the always-visible effects
- [x] 3.3 Wrap each row in a Mantine `Tooltip` carrying label + full
      description with `events={{ hover: true, focus: true, touch: true }}`,
      and make the row focusable so keyboard reveal works
- [x] 3.4 Render the empty/waiting state consistent with the other live panels
      ("Waiting for trait data…" / "Not connected to the dashboard server.")

## 4. Health screen layout

- [x] 4.1 Mount `TraitsList` in `EquipmentPanel.tsx`: left of the character
      model in the wide branch (fixed narrow column, own scroll, model keeps
      its current `maxModelWidth`)
- [x] 4.2 In the compact branch, stack the list above the model
- [ ] 4.3 Verify at both layouts (mobile 390x844, Ayaneo 1620x1080) that the
      model still drags to spin and that showing a tooltip moves nothing

## 5. Checks

- [x] 5.1 Add a unit test for `lib/traits.ts` covering: boosts present → chips
      with signed levels, no boosts → description fallback, ordering
- [x] 5.2 Run `bun test` and the project's typecheck
- [ ] 5.3 Verify end to end against the running game: a trait added or removed
      via the in-game stats window shows up in the list within one interval
