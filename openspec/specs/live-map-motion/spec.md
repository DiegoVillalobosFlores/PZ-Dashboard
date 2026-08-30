## Purpose

Defines how the dashboard turns the mod's discrete player position fixes into
continuous on-screen motion, so the player marker reads as smooth travel at
both walking and vehicle speeds rather than as a series of jumps.

## Requirements

### Requirement: Player marker moves continuously between position fixes

The dashboard SHALL animate the player marker continuously across the whole
interval between consecutive position fixes, without a visible period of
standstill between fixes while the player is moving at a constant speed.

#### Scenario: Steady vehicle travel

- **WHEN** consecutive position fixes arrive at a steady interval and each
  reports the player displaced by a constant distance
- **THEN** the marker's on-screen displacement per animation frame stays
  within 25% of the average displacement per frame over that interval
- **AND** the marker does not remain stationary for longer than one fix
  interval

#### Scenario: Walking speed unchanged

- **WHEN** the player travels on foot
- **THEN** marker motion remains continuous and the marker's reported position
  never leads the last received fix by more than one fix interval of travel

### Requirement: Marker converges on the reported position

Smoothing SHALL NOT let the displayed marker drift permanently away from what
the mod reports.

#### Scenario: Player stops

- **WHEN** position fixes stop reporting movement
- **THEN** the marker settles on the last reported position within 1 second
  and stays there

#### Scenario: Position jumps

- **WHEN** a fix reports a position far from the previous one, such as after a
  teleport, a save reload, or a dropped connection
- **THEN** the marker snaps directly to the new position instead of animating
  across the gap

#### Scenario: Fixes stop arriving

- **WHEN** no new position fix has arrived for longer than the expected fix
  interval
- **THEN** the marker stops advancing rather than continuing indefinitely in
  the last known direction

### Requirement: Position is sampled more often while in a vehicle

The mod SHALL sample and publish the player's map position at a shorter
interval while the player is in a vehicle than while on foot, and SHALL return
to the on-foot interval when the player exits the vehicle.

#### Scenario: Entering a vehicle

- **WHEN** the player enters a vehicle
- **THEN** subsequent map position snapshots are published at the vehicle
  interval

#### Scenario: Leaving a vehicle

- **WHEN** the player exits a vehicle
- **THEN** map position snapshots return to the configured on-foot interval

#### Scenario: Configured interval is respected

- **WHEN** the player has raised the Map Position interval in the mod options
  above the vehicle interval
- **THEN** the configured interval is used, so the vehicle cadence never
  publishes more often than the player asked for

### Requirement: Speed-based auto zoom is available and toggleable

The dashboard SHALL offer a setting that widens the map view while the player
is travelling fast and restores the previous view when they slow down. The
setting SHALL be togglable from the Settings screen and persist across
reloads.

#### Scenario: Enabled and travelling fast

- **WHEN** the setting is enabled and the player's speed exceeds the fast
  travel threshold
- **THEN** the map view widens to show more world area

#### Scenario: Enabled and slowing down

- **WHEN** the setting is enabled and the player's speed drops below the
  threshold
- **THEN** the map view returns to the zoom level in effect before the
  auto-zoom applied

#### Scenario: Disabled

- **WHEN** the setting is disabled
- **THEN** the map zoom level never changes in response to player speed

#### Scenario: Manual zoom wins

- **WHEN** the player manually zooms or pans while auto zoom is active
- **THEN** the manual view is kept and auto zoom does not override it for the
  remainder of that trip
