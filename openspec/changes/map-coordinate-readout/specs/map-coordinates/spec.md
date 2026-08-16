## Purpose

Shows the player's live world coordinates on the map HUD, so a player can write down a location, look it up on an external map, or read it out to someone else on the same save, and can turn that display off when they do not want it.

## ADDED Requirements

### Requirement: Coordinate readout

The HUD SHALL display the connected player's current world position as whole world squares, updating as the player moves.

#### Scenario: Player position is known

- **WHEN** the game is connected and reporting a player position
- **THEN** the HUD displays the player's X and Y as integers derived from the reported position by discarding the fractional part

#### Scenario: Player is above or below the ground floor

- **WHEN** the reported player Z level is not 0
- **THEN** the readout also displays the Z level
- **AND WHEN** the Z level is 0
- **THEN** the readout displays only X and Y

#### Scenario: No position reported yet

- **WHEN** no player position has been received
- **THEN** the readout is absent rather than showing placeholder or zero coordinates

#### Scenario: Map is panned away from the player

- **WHEN** the player pans or zooms the map away from their character
- **THEN** the readout keeps showing the character's coordinates, not the coordinates of the map view

### Requirement: Coordinate readout toggle

The dashboard SHALL let the player turn the coordinate readout off and on from the Settings screen, and SHALL remember that choice across reloads.

#### Scenario: Turning the readout off

- **WHEN** the player turns the "Coordinates" setting off
- **THEN** the coordinate readout disappears from the HUD immediately
- **AND** it is still absent after reloading the dashboard

#### Scenario: Default for a player who has never set it

- **WHEN** a player opens the dashboard with no stored preference for the coordinate readout
- **THEN** the readout is shown

#### Scenario: Preference stored before the setting existed

- **WHEN** a player has stored HUD settings that predate the coordinate setting
- **THEN** the readout is shown, as it would be for a player with no stored preference at all

#### Scenario: The surrounding HUD cluster is hidden

- **WHEN** the condition cluster is turned off
- **THEN** the coordinate readout is hidden with it, and its own toggle is shown as unavailable
