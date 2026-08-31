---
name: PZ Dashboard
description: A floating glass overwatch layer for Project Zomboid — live character and world state read at a glance, over a map that never unmounts.
colors:
  signal-orange: "#f76707"
  overwatch-black: "#141517"
  map-grey: "#2c2e33"
  panel-surface: "#25262b"
  tile-black: "#1a1b1e"
  tile-equipped: "#2a1a0d"
  border-default: "#373a40"
  text-primary: "#c1c2c5"
  text-secondary: "#909296"
  text-tertiary: "#878a91"
  status-success: "#40c057"
  status-warning: "#fcc419"
  status-danger: "#fa5252"
typography:
  display:
    fontFamily: "Chakra Petch, Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.1em"
  title:
    fontFamily: "Chakra Petch, Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.02em"
  body:
    fontFamily: "Inter, system-ui, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Chakra Petch, Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.08em"
  readout:
    fontFamily: "Share Tech Mono, Courier New, monospace"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  sharp: "2px"
  soft: "4px"
  softer: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  nav-tile-wide:
    backgroundColor: "rgba(20, 21, 23, 0.85)"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sharp}"
    size: "72px"
  nav-tile-wide-active:
    backgroundColor: "{colors.signal-orange}"
    textColor: "#ffffff"
    rounded: "{rounded.sharp}"
    size: "72px"
  nav-tab-mobile:
    backgroundColor: "transparent"
    textColor: "{colors.text-tertiary}"
    typography: "{typography.label}"
    height: "60px"
  nav-tab-mobile-active:
    backgroundColor: "transparent"
    textColor: "{colors.signal-orange}"
    typography: "{typography.label}"
    height: "60px"
  hud-icon-button:
    backgroundColor: "{colors.overwatch-black}"
    textColor: "{colors.signal-orange}"
    rounded: "{rounded.sharp}"
    size: "44px"
  glass-panel:
    backgroundColor: "rgba(20, 21, 23, 0.85)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sharp}"
    padding: "16px"
  drawer:
    backgroundColor: "rgba(20, 21, 23, 0.88)"
    textColor: "{colors.text-primary}"
    rounded: "0"
    padding: "18px"
  equip-tile:
    backgroundColor: "{colors.tile-black}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sharp}"
    size: "64px"
  equip-tile-active:
    backgroundColor: "{colors.tile-equipped}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sharp}"
    size: "64px"
  item-cell:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sharp}"
    padding: "8px 4px 6px"
  item-cell-selected:
    backgroundColor: "rgba(247, 103, 7, 0.22)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sharp}"
    padding: "8px 4px 6px"
  category-heading:
    backgroundColor: "transparent"
    textColor: "{colors.signal-orange}"
    typography: "{typography.label}"
    padding: "10px 16px 6px"
  tooltip:
    backgroundColor: "rgba(20, 21, 23, 0.85)"
    textColor: "{colors.text-primary}"
    typography: "{typography.readout}"
    rounded: "{rounded.sharp}"
    padding: "8px 12px"
---

# Design System: PZ Dashboard

## Overview

**Creative North Star: "The Glass Overwatch"**

The dashboard is not a screen the player visits. It is a layer of dark glass suspended above the world of Knox County, and the world never goes away underneath it. The map is the floor of the entire product — it is mounted before any screen and stays mounted through every navigation, keeping its pan, its zoom and the eased glide of the character marker. Everything else in the system is a pane of frosted, near-opaque glass that floats over that floor, casts a single soft shadow onto it, and can be dismissed to reveal it again. Nothing ever fills the viewport; nothing ever pretends the map is not still there.

The posture is observational, not conversational. The player's eyes are in the game; this surface is read in glances, at arm's length, from a handheld sitting beside the keyboard or a second monitor across the desk. So the system is built out of readouts rather than content: monospaced telemetry, uppercase display-face labels, hard 2px corners, tiles sized between 44px and 84px so a thumb finds them without aiming. Depth is carried by material — translucency and blur — not by an elevation ladder, because ranking panels against each other implies a hierarchy of attention the player does not have to spare. A pane is either glass over the world, or it is an opaque slot punched into that glass. There is no third state.

Colour is rationed to exactly one voice. Signal Orange marks what is live, held, selected or currently yours; the rest of the palette is a cold blue-grey ash that stays out of the way. Vitals borrow the only other colours in the system — green, amber, red — and only to report a number that has crossed a threshold. Rejected outright: any imitation of vanilla Project Zomboid's brown parchment panels and pixel typeface (the dashboard belongs *beside* the game, not inside it), and any decorative gaming treatment — neon glow, scanlines, glitch, animated gradient. A readout stays a readout.

**Key Characteristics:**
- A persistent map floor; floating glass panes that never fill the viewport
- One accent — Signal Orange — reserved for live, held or selected state
- 2px corners everywhere; no softness, no gradients, no elevation ramp
- Targeting-reticle corner brackets instead of borders on HUD surfaces
- Uppercase Chakra Petch labels over Share Tech Mono numeric readouts
- Touch targets from 44px to 84px, tuned for handheld arm's length
- Two layouts, one breakpoint: 900px separates wide from compact

## Colors

A cold, desaturated blue-black world with a single warm signal cut through it.

### Primary
- **Signal Orange** (`#f76707`): The system's only voice. It marks live and owned state and nothing else: the corner brackets on a filled slot, the active nav tile, category headings in every item list, the skill level readout, the selected item cell's fill and border. It appears at five calibrated strengths — a weak fill (`rgba(247,103,7,0.16)`) for passive highlight, a medium fill (`0.22`) for active selection and drag targets, and weak/medium/strong borders (`0.3` / `0.4` / `0.7`) for the same escalation on outlines. Full-strength `#f76707` is reserved for brackets, icons, text and the active nav tile.

### Neutral
- **Overwatch Black** (`#141517`): The base of everything. It is the app background at full opacity, the material of every floating pane at 85% (`rgba(20,21,23,0.85)`), and the material of every right-edge drawer at 88% (`rgba(20,21,23,0.88)`). It is one colour with three alphas, never three colours.
- **Map Grey** (`#2c2e33`): The map canvas and dense list rows — the world below the glass.
- **Panel Surface** (`#25262b`): Solid panel backing where translucency would cost legibility.
- **Tile Black** (`#1a1b1e`): Opaque on purpose. Every equipment and hotbar slot uses it so an item box reads as a solid slot cut into whatever frosted surface holds it, not as more glass.
- **Tile Equipped** (`#2a1a0d`): The lit variant of Tile Black. A warm near-black that means *this item is in hand right now* — the only place the accent hue appears as a surface rather than a mark.
- **Border Default** (`#373a40`): Structural strokes and dividers. Dividers render it at 50% opacity.
- **Ash Light / Ash Mid / Ash Dim** (`#c1c2c5` / `#909296` / `#878a91`): Primary, secondary and tertiary text. The whole type system lives in these three greys; pure white is used only on the active nav tile, where it sits on Signal Orange.

### Tertiary
- **Vital Green / Vital Amber / Vital Red** (`#40c057` / `#fcc419` / `#fa5252`): Threshold colours, never brand colours. Health crosses to amber below 70 and red below 40; other vitals stay in Ash Mid above 60, amber below 60, red below 30. Amber additionally marks a trait's left border. They report a number; they never decorate.

### Named Rules
**The One Signal Rule.** Signal Orange means *live, held, or selected*. If an element is not reporting current game state or the player's current choice, it does not get the accent — it gets Ash. A screen where the accent appears on more than a handful of elements has lost its meaning.

**The Threshold Rule.** Green, amber and red are computed from a value crossing a threshold (`healthColor`, `vitalColor`), never chosen by hand. If you are typing `#fa5252` into a component, you are decorating with an alarm colour.

## Typography

**Display Font:** Chakra Petch (600, 700), falling back to Inter and system UI
**Body Font:** Inter, falling back to system-ui, Segoe UI, Roboto
**Label/Mono Font:** Share Tech Mono, falling back to Courier New

**Character:** Chakra Petch is a squared-off technical face with clipped corners — it echoes the 2px geometry of the surfaces it labels, and set uppercase with wide tracking it reads as instrumentation rather than as prose. Share Tech Mono handles every number, so counts, levels, weights and ammo hold column alignment and never reflow as they tick. Inter carries the small amount of actual sentence-shaped text (tooltips, empty states, item names) and is deliberately the quietest of the three.

### Hierarchy
- **Display** (Chakra Petch 700, 18px, tracking 0.1em, uppercase): Drawer and screen titles only. The largest type in the system — this is a peripheral surface, and it never needs a hero.
- **Title** (Chakra Petch 600, 12–13px, tracking 0.02em): Skill names, settings row titles, panel sub-headings. Sentence case, because these are names rather than labels.
- **Body** (Inter 400, 13px): Empty states, tooltip prose, item names, hints. Also the fallback for anything not covered above.
- **Label** (Chakra Petch 700, 9–11px, tracking 0.08em, uppercase): The system's workhorse. Item-category headings, nav tab labels, slot names, section headers.
- **Readout** (Share Tech Mono 700, 10–12px): Every number in the product. Skill levels (`3/10`), trait modifiers, ammo counts, tooltip telemetry.

Display, Title and Label are carried by three utility classes in `index.css` — `.pz-display`, `.pz-title`, `.pz-label` — which own the family, weight, case and tracking. A component sets only its size and colour; it never restates the family or the tracking, and the three tracking steps exist only as `--tracking-display`, `--tracking-label` and `--tracking-title`. A fourth tracking value in a component style is drift.

### Named Rules
**The Numbers Are Mono Rule.** Any value that changes as the game runs is set in Share Tech Mono. A number in Inter is a bug — it will jitter as the digit widths change under it.

**The Labels Shout, The Data Speaks Rule.** Chrome — category names, slot names, section headers — is uppercase Chakra Petch with tracking. Content — item names, values, prose — is never uppercased. Never invert this to give a piece of content emphasis.

## Layout

**One breakpoint: 900px.** Above it, the wide layout (the Ayaneo-class handheld and desktop second monitors). Below it, the compact layout (phone portrait, 390×844). There is no third size, no tablet tier, and no container query — `useMediaQuery('(min-width: 900px)')` is the single switch, and every component that changes takes `wide` or `compact` as a prop rather than re-querying independently where it can be passed down.

**The shell owns the insets.** `HudShell` is a persistent layout route: map, vitals cluster, nav and hotbar mount there and survive navigation; only `<Outlet />` swaps. It publishes four CSS custom properties that every screen composes against instead of hardcoding margins:

- `--hud-top-inset`: 88px wide, 76px compact — clearance for the vitals cluster
- `--hud-left-inset`: 112px wide, 12px compact — clearance for the left nav rail
- `--hud-right-inset`: 80px wide, 12px compact — clearance for the floating map buttons
- `--hud-hotbar-inset`: measured live by a `ResizeObserver` on the hotbar, because the hotbar reflows between one and two rows

**Wide layout.** Nav is a vertical rail of 72px square tiles at the left edge (24px in), vertically centred, sitting directly on the map with no panel behind it. The vitals cluster sits top-left beside the rail. Map controls float at the right edge. Screens open as centred panes inside the shell's insets.

**Compact layout.** Nav becomes a full-width 60px bottom tab bar — real thumb reach beats a corner rail — which frees the entire top edge for the single-row vitals cluster. The right-edge map buttons are hidden entirely; the bar respects `env(safe-area-inset-bottom)`.

**Spacing rhythm** runs on 4px: 4 / 6 / 8 / 10 / 12 / 16 / 24. Gaps between sibling tiles are 6–8px; panel padding is 16–18px; the gap between wide nav tiles is 16px.

### Named Rules
**The Map Never Goes Away Rule.** No screen is full-bleed and no screen is opaque edge-to-edge. Every screen composes inside `--hud-*-inset` and lets the world show around it. A layout that covers the map has stopped being a HUD.

**The Insets Are The Contract Rule.** Never hardcode a margin to clear the nav rail, the vitals pill or the hotbar. Read the shell's custom properties — the hotbar one is measured at runtime and your constant will be wrong the moment it reflows.

## Elevation & Depth

Depth is **material, not elevation**. There is no shadow ramp and no z-ordering of panels against each other, because ranking panes implies a hierarchy of attention this player does not have to spare. Instead there are exactly two states a surface can be in: *glass over the world*, or *an opaque slot punched into the glass*.

Glass surfaces are Overwatch Black at 85–88% alpha with `backdrop-filter: blur(10px) saturate(1.1)` — the map stays visible and slightly saturated through them, which is what makes the layer read as suspended rather than pasted on. The single shadow does one job: separate the floating layer from the map floor. It never says "this panel is above that panel."

Opaque surfaces — every equipment tile, every hotbar slot, the map control buttons — use flat `#1a1b1e` with no blur at all. That contrast is the entire depth system: a solid box inside a translucent pane reads instantly as a slot you can fill.

### Shadow Vocabulary
- **Floating** (`--shadow-float`, `0 3px 16px rgba(0, 0, 0, 0.4)`): Every panel, tooltip and map button. One value, used everywhere.
- **Drawer** (`--shadow-drawer`, `-12px 0 32px rgba(0, 0, 0, 0.4)`): Right-edge drawers only, thrown leftward to sell the slide-in.
- **Bottom bar** (`--shadow-float-up`, `0 -3px 16px rgba(0, 0, 0, 0.4)`): The mobile nav bar, the Floating shadow inverted.

### Named Rules
**The One Shadow Rule.** `0 3px 16px rgba(0,0,0,0.4)` is the shadow. The other two are the same shadow pointed a different direction. Inventing a fourth means you are building an elevation ramp this system deliberately does not have.

**The Opaque Slot Rule.** Anything that holds an item — hotbar slot, hand widget, paperdoll tile — is opaque `#1a1b1e`, never glass. Blur it and the slot dissolves into the pane behind it and the player loses the boundary they aim at.

## Shapes

**2px, effectively square.** `--radius-sharp: 2px` is the radius for every surface in the product: panels, drawers, tiles, buttons, tooltips, item cells. The Mantine theme is configured so `xs`, `sm` and `md` all resolve to 2px, with 4px and 6px reserved at `lg`/`xl` and used essentially nowhere. Drawers are hard 0. The one deliberate exception is the connection-status pill, which is a full 999px capsule precisely because it is transient chrome and not part of the instrument.

**Brackets instead of borders.** The signature form is the corner bracket: eight 2px ticks drawn at the four corners of a surface, in Signal Orange at 85% opacity, leaving the edges open. It replaces a stroke on every HUD surface — drawers (22px arms, 8px inset), map buttons (10px arms, 3px inset), equipment tiles (8–12px arms, scaled per tile size). It is not decoration; on a tile it is *the* signal that the slot is filled.

**Strokes where brackets don't fit.** Dense list content uses a real 1px `#373a40` border — item cells, trait chips, tooltips. Selection replaces that with a 1px Signal Orange border at 0.7 alpha. Traits carry a 2px amber left border as a category flag.

### Named Rules
**The Sharp Corner Rule.** 2px. If a new surface wants 8px because it looks friendlier, the answer is no — the squared geometry is what makes the type face and the brackets cohere.

**The Brackets Mean Occupied Rule.** On any slot, corner brackets mean the slot holds something and a lit `#2a1a0d` background means it is in hand right now. These two marks mean the same thing in the hotbar, the hand widget and the paperdoll. Do not reuse brackets for hover, focus or emphasis.

## Components

### Navigation
- **Wide rail:** 72px square tiles, 16px gap, vertical, at the left edge. Each tile carries the frosted glass itself (85% Overwatch Black + blur) since the rail sits straight on the map with no panel behind it. Icons at 28px in Ash Mid, stroke 2. A keyboard-shortcut digit sits top-right at 10px in Ash Dim.
- **Active (wide):** the tile fills with Signal Orange at 85% opacity; icon and shortcut digit go pure white and the icon stroke thickens to 2.5.
- **Mobile bar:** full-width 60px tab bar, glass background, 1px top border, `env(safe-area-inset-bottom)` padding. Icon at 22px over a 9px uppercase Chakra Petch label.
- **Active (mobile):** icon and label go Signal Orange, stroke 2.5, and a 28×2px Signal Orange bar pins to the top edge of the tab. The tab background never fills.
- Keys `1`–`5` map to the five destinations; `Escape` returns to the map. Both listeners live at the shell level.

### Cards / Containers (GlassPanel)
- **Corner Style:** 2px.
- **Background:** `rgba(20,21,23,0.85)` with `blur(10px) saturate(1.1)`. Denser panels and drawers hold a higher alpha than the inventory modal so their readouts stay legible over a busy map.
- **Shadow:** the Floating shadow, always; see Elevation & Depth.
- **Border:** none. Optional corner brackets instead, passed as `{ length, thickness, inset, opacity }`.
- **Internal Padding:** 16px compact, 18px wide.

### Buttons
- **HUD icon button:** 44px square, **opaque** `#141517` (not glass — these sit alone on the map and need to hold their own edge), 2px radius, Floating shadow, 10px corner brackets at 3px inset, a single 20px Signal Orange icon centred. Recentre and map-notes use this.
- **Text buttons:** Mantine `Button` on the accent palette at shade 5 with `defaultRadius: 'xs'` (2px). `subtle` is the default for secondary and destructive-adjacent actions; `filled` is used only to mark an armed confirmation (Reset all → Confirm reset).
- **Disabled:** opacity 0.55 with the cursor left as default, used across every action tile when the client lacks write access; the tile keeps its title attribute explaining why.

### Equipment tile (signature component)
The one tile every equipped item is drawn as — hotbar tray, hand widget, and worn-clothing paperdoll differ only in the spec they pass and how they arrange tiles. Box sizes: hotbar 64/52, hand 84/62, worn 72/54 (wide/compact). Background is opaque Tile Black, or Tile Equipped when in hand. Corner brackets appear only when filled. A 3px condition bar inset at the bottom reports item condition in the vital threshold colours. The hotbar variant adds a key-number badge top-left; the hand variant insets its slot name and item name; the worn variant captions beneath the box.

### Item cells and lists
- **Cell:** auto-fill grid at 76px (compact) / 84px (wide) minimum, 8px gaps. 1px `#373a40` border over `rgba(255,255,255,0.06)`, 2px radius, 88–92px min height, icon over an 11px name.
- **Selected:** 1px Signal Orange border at 0.7 alpha over the 0.22 accent fill.
- **Drag target:** the whole scroll region takes the 0.22 accent fill while a valid drop hovers.
- **Category heading:** an 11px uppercase Chakra Petch button in Signal Orange, with an All/None toggle in Ash Dim on the right. Every item list in the product — inventory, weapon drawer, clothing drawer — is grouped this way, using the game's own item categories.

### Drawers
Right-edge Mantine `Drawer`, 480px wide / 330px compact, hard 0 radius, no close button of its own. Background `rgba(20,21,23,0.88)` + blur, the Drawer shadow, overlay at 0.5 opacity with 2px blur, `slide-left` at 200ms. 22px corner brackets at 8px inset frame the whole panel. The header is an 18px uppercase Chakra Petch title with a bare 20px close icon in Ash Mid.

### Inputs
Mantine `TextInput` and `Switch` on the theme defaults — 2px radius, accent shade 5 for the switch's on state. Inputs appear only on the Settings screen; the rest of the product is built from tiles and toggles, and should stay that way.

### Tooltips
Glass background + blur, 2px radius, Floating shadow, 12px Share Tech Mono at line-height 1.5, 8×12px padding, max 300px, with a 6px arrow. Used to carry the full explanation of every vital and condition, so the pill itself can stay a bare number.

## Do's and Don'ts

### Do:
- **Do** compose every screen inside `--hud-top-inset`, `--hud-left-inset`, `--hud-right-inset` and `--hud-hotbar-inset` rather than hardcoding clearance. The hotbar inset is measured at runtime.
- **Do** use `--radius-sharp` (2px) for every new surface, and `--frost-blur` for anything that floats over the map.
- **Do** reach for `GlassPanel` and `CornerBrackets` before writing a new floating surface; the frosted material and the bracket frame are already one decision.
- **Do** set every changing number in `var(--font-mono)` and every label in uppercase `var(--font-display)` with 0.06–0.1em tracking.
- **Do** derive status colour from `healthColor()` / `vitalColor()` / `conditionColor()` so a threshold is computed, not eyeballed.
- **Do** branch layout on the single 900px breakpoint, and pass `wide` / `compact` down as a prop where a parent already knows it.
- **Do** keep touch targets at 44px or above — 44px map buttons, 52–84px tiles, 60px mobile tabs, 72px nav tiles — this is read at arm's length on a handheld.
- **Do** distinguish off, stale, and never-received state visually; keep the last known reading visible and dimmed rather than blanking the panel.

### Don't:
- **Don't** soften a corner past 2px. There is no 8px card in this system.
- **Don't** add a fourth shadow or build an elevation ramp. One Floating shadow, plus its two rotations for drawers and the bottom bar.
- **Don't** blur an item slot. Slots are opaque `#1a1b1e` (or `#2a1a0d` when in hand) so their boundary survives a busy map behind them.
- **Don't** spend Signal Orange on anything that is not live, held or selected. It is the only voice in the palette and its rarity is what makes it readable at a glance.
- **Don't** reuse corner brackets for hover, focus or emphasis. On a slot they mean *occupied*, and that meaning has to hold in all three tile variants.
- **Don't** imitate vanilla Project Zomboid's brown parchment panels or pixel typeface. The dashboard sits beside the game, not inside it.
- **Don't** add neon glow, scanlines, glitch effects, animated gradients or RGB cycling. Readouts stay readouts.
- **Don't** let a screen cover the map edge to edge, or unmount the shell to get more room.
- **Don't** uppercase content to give it emphasis — uppercase belongs to chrome only.
