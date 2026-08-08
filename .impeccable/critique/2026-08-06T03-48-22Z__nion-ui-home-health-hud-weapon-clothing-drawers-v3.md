---
target: "Penpot: PZ Companion UI — Home/Health HUD + Weapon/Clothing drawers (v3)"
total_score: 18
max_score: 28
na_heuristics: 5,9,10
p0_count: 3
p1_count: 2
timestamp: 2026-08-06T03-48-22Z
slug: nion-ui-home-health-hud-weapon-clothing-drawers-v3
---
Method: dual-agent (A: ac1ad19e8f68d757b · B: a2988b3ba2f04fb87) — Assessment B's task also included a CLI-detector step against a code implementation; that implementation and dev server belong to a separate agent's in-progress work on `web/`, out of scope for this design-only critique per your instruction. Only B's independent Penpot-canvas visual audit is used below, on equal footing with Assessment A.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Stat pills + EQUIPPED tags are clear; map pins have no legend |
| 2 | Match System / Real World | 3 | Paperdoll + condition labels + numbered hotbar mirror PZ's real systems; undercut by clothing icons that don't match the actual garment |
| 3 | User Control and Freedom | 2 | Drawers only expose a small top-right X; mobile's drag-handle was removed, leaving a fiddly one-handed close target |
| 4 | Consistency and Standards | 2 | Uppercase+tracked treatment applied only to section headers, not body/item text; icon language splits between game-specific and generic outline icons |
| 5 | Error Prevention | n/a | Static mockup, no destructive actions depicted |
| 6 | Recognition Rather Than Recall | 3 | — |
| 7 | Flexibility and Efficiency | 2 | Single accent state only; no shortcuts or customization visible |
| 8 | Aesthetic and Minimalist Design | 3 | — |
| 9 | Error Recovery | n/a | No error states depicted |
| 10 | Help and Documentation | n/a | Not applicable to a HUD mockup |
| **Total** | | **18/28** | **Acceptable (64%)** |

## Design Specificity Verdict

**Start here — this is the real answer to "does it look like a game or an app?"**: right now, **partially**. The screens split cleanly into a HUD half that's already working and a settings-app half that isn't.

**LLM assessment (Assessment A)**: The two most PZ-specific artifacts in the file are the equipment paperdoll (7 anatomically-placed slots — HEAD/FACE/TORSO/BACK/HANDS/LEGS/FEET — mirroring PZ's real clothing system) and the numbered 1–4 hotbar with equipped-highlight, a faithful touch translation of PZ's toolbar keybinds. Everything else could belong to any dark-mode utility app. Confirmed directly in the underlying `ListItem` master component: a rounded gray icon box + plain-case title + subtitle + trailing chevron — structurally identical to an iOS Settings row, with only the icon swapped between screens.

**Independent evidence scan (Assessment B)**: Catalogued per-screen, the Home (HUD) boards are the strongest HUD reads — corner-anchored vitals, corner-anchored quick-nav, bottom-center hotbar over a full-bleed map, no card chrome wrapping the whole screen. The Health/Equipment screen is the **weakest** HUD read of the two "Screen" boards, despite having the most game-specific content: it wraps the paperdoll in a centered, titled card with a labeled icon grid — a profile/settings-page composition, not a corner-anchored overlay. Both Weapon and Clothing drawers are the most generic screens of all eight: plain vertical list rows, icon-in-square + name + subtitle + trailing badge, no per-item art. The Clothing drawer reuses one shirt-outline icon across four visually distinct garments (Flannel Shirt, Hoodie, Denim Jacket, Bloodied T-Shirt); the Weapon drawer's Baseball Bat uses a generic package/cube icon instead of anything bat-shaped.

**Where they sharpen each other**: A frames the paperdoll's *content* as the strongest specificity signal in the file. B's screen-level framing shows that content is being undercut by a generic *composition* around it (centered card, not overlay). Both are true at once — the fix isn't the paperdoll itself, it's how it's housed.

**One correction to Assessment B's read on corners**: B recorded the Home board's outer frame radius as 0 in the Design panel, which is accurate but only describes the full-bleed screen container. Direct visual inspection (both agents' screenshots and mine) shows every piece of interior chrome — hotbar slots, icon-rail buttons, the top status pill, drawer panels, and list-item cards — rendered with clearly rounded corners. So the sharp/angular intent holds at the outermost frame but is not carried through to any actual UI chrome, which is where a player's eye actually lands.

## Overall Impression

The bones are there — a numbered hotbar, a real equipment paperdoll, a disciplined single-accent palette, a full-bleed map background — and the Home HUD screens already read as something closer to a game overlay than a phone app. But the moment a user opens a drawer or the Health screen, the UI reverts to default component-library instincts: rounded cards, an icon-in-a-box + title + subtitle list row, and completely flat, textureless panels standing in for what the design system calls "floating translucent glass." The single biggest opportunity is closing that gap — carrying the Home screen's HUD-overlay logic (corner-anchored, translucent, angular, glowing-on-select) into the drawers and the Health screen instead of falling back to Settings-row conventions there.

## What's Working

- **Numbered hotbar with equipped-highlight** — a faithful, touch-adapted translation of PZ's actual toolbar mechanic, not a generic action bar.
- **Equipment paperdoll** — real anatomical slot mapping (HEAD/FACE/TORSO/BACK/HANDS/LEGS/FEET) beats a flat inventory list for spatial recognition, and is unmistakably *this* game's system.
- **Disciplined color use** — one orange accent, applied meaningfully to selected/equipped state (not decoratively), against near-black/gray everywhere else.

## Priority Issues

**[P0] Panels are flat, not "glass."** Every one of the 8 boards uses solid opaque fills (`#141517`/`#2c2e33`) with a thin low-opacity orange stroke — no translucency, no blur-through-map, no gradient, bevel, or glow, despite the design system's own tokens being named for exactly that treatment. The map and paperdoll get fully occluded by UI instead of showing through it.
**Why it matters**: this is the single biggest visual tell that reads "app" instead of "game" — a real HUD lets the world stay visible behind the interface.
**Fix**: apply real backdrop-blur + partial opacity to every panel (status pill, hotbar, drawers, Health card) so the map/silhouette stays visible underneath.
**Suggested command**: `/impeccable overdrive`

**[P0] Weapon/Clothing drawers are generic Settings-row chrome.** Confirmed at the component level (the `ListItem` master: icon box + title + subtitle + chevron) and confirmed as the most "app-like" screens of all eight in independent visual review. The Clothing drawer reuses one icon across four different garments; the Weapon drawer shows a package icon for a baseball bat.
**Why it matters**: this is where the player spends the most deliberate attention (choosing gear mid-fight) — it's also the screen furthest from feeling like the game.
**Fix**: replace the generic list-row pattern with per-item art/silhouettes and a layout that reads as a loadout/inventory grid rather than a picker list; give every item its own recognizable icon.
**Suggested command**: `/impeccable distill` (strip the Settings-row pattern) followed by `/impeccable bolder`

**[P0] Chrome is uniformly soft/rounded despite a stated "sharp, tactical, not soft app" intent.** The outer screen frame is 0-radius, but every actual piece of UI — hotbar slots, icon-rail buttons, the status pill, drawer panels, list cards — is rounded.
**Why it matters**: rounded corners are one of the strongest subconscious "this is a consumer app" signals; the intent is already written down, it's just not reaching the components users actually touch.
**Fix**: chamfered/angular corners (or a small, consistent asymmetric-cut treatment) on hotbar slots, drawer panels, and list rows; reserve any rounding for truly soft elements only, if any.
**Suggested command**: `/impeccable bolder`

**[P1] HUD typography voice stops at section headers.** Uppercase + letter-spacing is applied to labels like EQUIPMENT, SELECT WEAPON, and slot names — but item names, condition text ("Good condition," "Worn"), and values drop straight into plain sentence-case default sans, breaking the register mid-screen.
**Why it matters**: inconsistent type voice is a subtle but constant reminder that this is a generic UI wearing a game skin in places.
**Fix**: define and apply a real two-tier type system — a HUD/display face for numbers and short state labels, consistently, not just at headers.
**Suggested command**: `/impeccable typeset`

**[P1] The signature "orange glow" has no glow.** Selected/equipped states (EQUIPPED badge, active hotbar slot, selected map pin, active Health slot) all use flat fill or stroke — never a bloom or shadow — despite that being the named identity element of the whole system.
**Why it matters**: this is a cheap, high-leverage fix that would do more for the "game feel" than most other changes on this list.
**Fix**: add an actual colored glow/shadow behind every selected/active/equipped element.
**Suggested command**: `/impeccable colorize`

## Persona Red Flags

**The mid-fight weapon swapper (mobile, one hand)**: the drawer's drag-handle was intentionally removed in v3 (per the designer's own handover note) in favor of a small top-right X — a fiddly, low-confidence target to hit one-handed under pressure, and the drawer itself is a generic list a player has to read rather than instantly recognize.

**The glanceable-read power user**: the top status strip packs 5 unlabeled icon+percentage readouts into one tight pill (88% / 64% / 71% / 40% / 55%). PRODUCT.md's own principle is "glanceable, not a reading session" — but this requires the player to have memorized which icon maps to which vital before it's glanceable at all.

**The returning/casual player**: generic equipment icons (a glasses outline for FACE, stacked layers for LEGS) require reading the tiny label underneath rather than recognizing the icon at a glance — the opposite of what an icon is for.

## Minor Observations

- Map pins are stock teardrop glyphs, visually identical to Google Maps — no in-world styling.
- Hotbar icon set is inconsistent across boards (pencil vs. paint-roller vs. flashlight vs. cube for what should be comparable slot types).
- Designer rationale sticky notes are still live on-canvas — fine mid-process, worth clearing before a handoff pass.
- Component library naming (Badge, ListItem, ProgressBar) still describes generic app parts; renaming toward game vocabulary (e.g. LoadoutRow, VitalGauge) might help keep future edits from defaulting back to app instincts.

## Questions to Consider

- Hide the PZ logo and show these boards cold — would someone guess "Zomboid," or stop at "post-apocalyptic survival app"?
- If the Home screen's corner-anchored, translucent HUD logic became the *only* layout pattern in the file — no more centered cards, no more list rows — what would the Health screen and the drawers have to become?
- Is the current flat, glow-less rendering a deliberate legibility choice for a phone screen in daylight, or simply not built yet — because the right fix is completely different depending on which one it is.
