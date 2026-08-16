## Why

The Health screen shows the character's body, worn equipment and vitals, but
nothing about the traits the character was built with. Traits are the one part
of a character sheet the player cannot re-check mid-run without opening the
in-game stats window, which is exactly the kind of reference lookup the
second-screen dashboard exists to take over.

## What Changes

- The mod gains a `traits` collector that reports the player's known character
  traits: id, label, description, cost, profession-trait flag, the icon
  texture name, and the trait's XP boosts as `{ perk, perkName, level }`.
- `traits` is registered as a normal streamed category (own enable/interval
  option, default interval on the slow end since traits rarely change).
- The Health screen shows those traits as a list to the left of the character
  model, each row rendering the trait's own in-game icon (served through the
  existing `/game-icons/:name` texture-pack route — trait textures are already
  in the packs under names like `trait_athletic`).
- Each row always shows its effects: XP boost chips (`Axe +2`, `Fitness -1`)
  when the trait has boosts, otherwise a single clamped line of the game's own
  description text.
- The full description appears only on hover (and on focus/tap for touch and
  keyboard), never inline.
- On the mobile layout the list stacks above the model instead of sitting
  beside it.

## Capabilities

### New Capabilities
- `character-traits`: collecting the player's character traits from the game
  and presenting them on the Health screen with icons, always-visible effects
  and hover-revealed descriptions.

### Modified Capabilities

(none — no existing spec files in `openspec/specs/`)

## Impact

- `mod/PZDashboard/42/media/lua/client/PZDashboard/PZDashboard_Collectors.lua`
  — new `PZDashboard.Collectors.traits`.
- `mod/PZDashboard/42/media/lua/shared/PZDashboard/PZDashboard_Categories.lua`
  — new category row (drives options, scheduling and the manifest generically).
- `server/src/web/lib/liveTypes.ts` — `TraitsSnapshot`, `TraitSnapshot`,
  `CategoryMap.traits`.
- `server/src/web/components/EquipmentPanel.tsx` — traits column beside the
  paperdoll; new `TraitsList` component.
- No server-side work: the watcher derives categories from filenames, and trait
  icons already resolve through the existing texture-pack icon route.
- Requires a mod redeploy (`bun scripts/deploy-mod.ts`) and a Lua reload; the
  new category is off-by-default-safe because unknown categories are ignored by
  older clients.
