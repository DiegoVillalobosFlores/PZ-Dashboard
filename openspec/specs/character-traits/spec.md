## Purpose

Streams the player character's traits from the running game and presents them
alongside the character's skills, so the player can check what their character
is good and bad at without opening the in-game character window.

## Requirements

### Requirement: Traits are streamed as a live category

The mod SHALL collect the player's known character traits and publish them as a
`traits` category over the normal state channel, using the same enable/interval
option pair as every other category.

Each trait entry SHALL carry: a stable id, the localized label, the localized
description, the trait's point cost, whether it is a profession (free) trait,
the name of the trait's in-game icon texture (empty when the trait has none),
its XP boosts as a list of `{ perk, perkName, level }`, and its non-XP gameplay
modifiers as a list of `{ label, value }`.

Modifiers SHALL be supplied by the mod because the game exposes no API for
them: a table of known trait effects, matched case-insensitively by trait id,
plus any foraging bonuses the game's own foraging definitions do expose.

#### Scenario: Traits published on connect

- **WHEN** the dashboard is connected and the collector runs
- **THEN** a `traits` state update is delivered containing one entry per trait
  the character knows, and no entries for traits the character does not have

#### Scenario: Trait removed in game

- **WHEN** a trait is added to or removed from the character while the
  dashboard is connected
- **THEN** the next `traits` update reflects the new set within one collector
  interval

#### Scenario: Game API unavailable

- **WHEN** a field of a trait cannot be read from the game
- **THEN** the collector still publishes the trait with a safe empty/zero value
  for that field rather than dropping the category or erroring

### Requirement: Skills screen lists traits beside the skills

The Skills screen SHALL show the character's traits alongside the skill
categories. On the wide (handheld) layout the screen SHALL split into two
columns, skills on one side and traits on the other; on the mobile/compact
layout the two SHALL stack and scroll together.

Traits SHALL be split into a "Positive" group (cost of zero or more) and a
"Negative" group (cost below zero), each ordered by descending cost and then by
label. A group with no traits SHALL still render its heading with a "None"
placeholder rather than disappearing.

Each row SHALL show the trait's own in-game icon, served by the server from the
game's texture files, and its label. When the icon name is empty or the image
fails to load, the row SHALL fall back to a placeholder mark and still render
label and effects.

#### Scenario: Wide layout

- **WHEN** the Skills screen is viewed at the wide (handheld) layout with trait
  data available
- **THEN** the trait groups render in their own column beside the skill
  categories, and the skill list keeps its existing tiles and scrolling

#### Scenario: Compact layout

- **WHEN** the Skills screen is viewed at the mobile layout
- **THEN** the trait groups render below the skills and scroll with the rest of
  the panel

#### Scenario: No data yet

- **WHEN** no `traits` snapshot has arrived
- **THEN** the trait area shows a waiting or not-connected message consistent
  with the other live panels, and does not collapse the screen's layout

### Requirement: Trait effects are always visible

Each trait row SHALL display its effects without any interaction.

When the trait has gameplay modifiers or XP boosts, the effects SHALL be shown
as one chip each: a modifier chip giving its label and value (for example
`Panic gain -70%`), and a boost chip giving the perk name and the signed level
delta (for example `Axe +2`, `Fitness -1`). Modifier chips SHALL come before
boost chips.

When the trait has neither, the effects SHALL instead be the trait's own
in-game description, wrapped within the row.

#### Scenario: Trait with XP boosts

- **WHEN** a trait such as Axeman is displayed
- **THEN** the row shows a chip per boosted perk with its signed level delta,
  and shows no description text

#### Scenario: Trait with modifiers

- **WHEN** a trait such as Brave is displayed
- **THEN** the row shows a chip per known gameplay modifier with its value

#### Scenario: Trait without effects

- **WHEN** a trait has no modifiers and no XP boosts
- **THEN** the row shows the game's description text instead of chips

### Requirement: Full description is revealed only on hover or focus

The trait's full description SHALL NOT be rendered inline for traits that show
effect chips. It SHALL appear only while the row is hovered, keyboard-focused,
or tapped on a touch device, as a transient overlay that does not reflow the
surrounding layout. The overlay SHALL carry the label and the description, and
SHALL use the same glass-panel treatment as the rest of the HUD.

Each row SHALL be keyboard-focusable and SHALL expose its label and description
to assistive technology.

#### Scenario: Hover

- **WHEN** the pointer rests on a trait row
- **THEN** the trait's full label and description appear in a tooltip, and
  disappear when the pointer leaves

#### Scenario: Keyboard

- **WHEN** a trait row receives keyboard focus
- **THEN** the same description is shown, so the information is reachable
  without a pointer

#### Scenario: Touch

- **WHEN** a trait row is tapped on a touch device
- **THEN** the description is shown and dismissed by tapping elsewhere

#### Scenario: Missing description

- **WHEN** a trait reports no description
- **THEN** the overlay shows a "No description available." fallback rather than
  an empty panel

#### Scenario: Layout stability

- **WHEN** the description is shown or hidden
- **THEN** no other trait row, skill tile, or group heading moves
