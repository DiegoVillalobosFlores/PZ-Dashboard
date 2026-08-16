## Purpose

Streams the player character's traits from the running game and presents them
on the Health screen, so the player can check what their character is good and
bad at without opening the in-game character window.

## ADDED Requirements

### Requirement: Traits are streamed as a live category

The mod SHALL collect the player's known character traits and publish them as a
`traits` category over the normal state channel, using the same enable/interval
option pair as every other category.

Each trait entry SHALL carry: a stable id, the localized label, the localized
description, the trait's point cost, whether it is a profession trait, the name
of the trait's in-game icon texture (empty when the trait has none), and its XP
boosts as a list of `{ perk, perkName, level }`.

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

### Requirement: Health screen lists traits beside the character

The Health screen SHALL show the character's traits as a vertical list placed
to the left of the character model, ordered with positive-cost (beneficial)
traits before negative-cost ones. On the mobile/compact layout the list SHALL
stack above the character model instead of sitting beside it.

Each row SHALL show the trait's own in-game icon and its label. When the icon
texture is missing or fails to load, the row SHALL still render label and
effects.

#### Scenario: Wide layout

- **WHEN** the Health screen is viewed at the wide (handheld) layout with trait
  data available
- **THEN** the trait list renders to the left of the character model, and the
  model keeps its existing size and drag-to-spin behavior

#### Scenario: Compact layout

- **WHEN** the Health screen is viewed at the mobile layout
- **THEN** the trait list renders above the character model and scrolls with
  the rest of the panel

#### Scenario: No data yet

- **WHEN** no `traits` snapshot has arrived
- **THEN** the trait area shows a waiting/not-connected message consistent with
  the other live panels, and does not collapse the equipment layout

### Requirement: Trait effects are always visible

Each trait row SHALL display its effects without any interaction.

When the trait has XP boosts, the effects SHALL be shown as one chip per boosted
perk, giving the perk name and the signed level delta (for example `Axe +2`,
`Fitness -1`).

When the trait has no XP boosts, the effects SHALL instead be a single clamped
line of the trait's own in-game description, truncated with an ellipsis when it
does not fit.

#### Scenario: Trait with XP boosts

- **WHEN** a trait such as Axeman is displayed
- **THEN** the row shows a chip per boosted perk with its signed level delta,
  and shows no description snippet

#### Scenario: Trait without XP boosts

- **WHEN** a trait such as Thick Skinned is displayed
- **THEN** the row shows the first line of the game's description text, clamped
  to one line

### Requirement: Full description is revealed only on hover or focus

The trait's full description SHALL NOT be rendered inline. It SHALL appear only
while the row is hovered, keyboard-focused, or tapped on a touch device, as a
transient overlay that does not reflow the surrounding layout.

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

#### Scenario: Layout stability

- **WHEN** the description is shown or hidden
- **THEN** no other trait row, the character model, or the equipment grid moves
