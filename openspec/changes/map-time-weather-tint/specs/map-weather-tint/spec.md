## Purpose

Reflects the game's current daylight and weather on the companion map, so the second screen reads like it is watching the same world and the player can see nightfall or an incoming storm at a glance, without the map ever becoming hard to read.

## ADDED Requirements

### Requirement: Tinting by light and weather

The map SHALL be tinted from the game's reported daylight, precipitation, snow and fog values, and SHALL update as they change.

#### Scenario: Full daylight, clear weather

- **WHEN** daylight is at full strength with no precipitation, snow or fog
- **THEN** the map is drawn untinted

#### Scenario: Nightfall

- **WHEN** daylight strength falls
- **THEN** the map darkens in proportion, reaching its darkest at full night

#### Scenario: Rain

- **WHEN** precipitation intensity rises with no snow reported
- **THEN** the map greys in proportion, in addition to any darkening from daylight

#### Scenario: Snow

- **WHEN** precipitation is falling and snow strength is above zero
- **THEN** the weather component of the tint is paler than the equivalent rain, so snow and rain are distinguishable

#### Scenario: Fog

- **WHEN** fog intensity rises
- **THEN** the map is washed out in proportion

#### Scenario: Values change between updates

- **WHEN** the reported climate values change from one status update to the next
- **THEN** the tint moves smoothly to the new value rather than stepping visibly

### Requirement: Legibility

The tint SHALL never prevent the player from reading the map or the interface on top of it.

#### Scenario: Worst case conditions

- **WHEN** it is full night with heavy precipitation and heavy fog at once
- **THEN** the tint does not exceed its maximum strength, and streets, place labels, the player marker and route remain distinguishable

#### Scenario: Interface elements

- **WHEN** the map is tinted at any strength
- **THEN** the vitals pill, nav rail, hotbar, map buttons and any open drawer or modal are unaffected

#### Scenario: Map interaction

- **WHEN** the map is tinted
- **THEN** panning, zooming, double-tap-to-route and every other map interaction behave exactly as they do untinted

### Requirement: Player control

The player SHALL be able to turn the tint off, and that choice SHALL persist.

#### Scenario: Turning the tint off

- **WHEN** the player turns the map tint setting off
- **THEN** the map is drawn untinted immediately, and stays untinted after a reload

#### Scenario: Default

- **WHEN** a player has never set the preference
- **THEN** the tint is on

### Requirement: Degrading without climate data

The map SHALL render untinted whenever the game's climate values are unavailable, rather than assuming darkness.

#### Scenario: Mod does not report climate

- **WHEN** the connected mod sends a status snapshot with no climate values
- **THEN** the map is untinted and no error is surfaced

#### Scenario: A climate value cannot be read

- **WHEN** one climate value is missing or unreadable while others are present
- **THEN** that value contributes nothing to the tint and the others still apply

#### Scenario: Out-of-range values

- **WHEN** a reported climate value falls outside its expected range
- **THEN** it is clamped, and the tint stays within its legibility cap
