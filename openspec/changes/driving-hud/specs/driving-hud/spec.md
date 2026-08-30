## Purpose

Defines what the dashboard shows the player while they are driving: which
vehicle readouts appear, when the driving display comes and goes, how the
player toggles or collapses it, and what the mod must publish to feed it.

## ADDED Requirements

### Requirement: The mod publishes driving telemetry for the occupied vehicle

The mod SHALL publish, for the vehicle the player is currently in, the
readings the game's own vehicle dashboard displays: current speed in km/h,
remaining fuel as a fraction of tank capacity, whether the engine is running,
whether the ignition is engaged, battery charge, whether the headlights are
on, the engine's condition, the vehicle's overall condition and the current
transmission gear. Each reading SHALL be omitted rather than guessed when the
game cannot supply it.

#### Scenario: Player is driving

- **WHEN** the player is seated in a vehicle
- **THEN** the vehicle marked as the player's current vehicle carries the
  driving telemetry readings alongside its existing identity and position
  fields

#### Scenario: Player is not in a vehicle

- **WHEN** the player is on foot
- **THEN** no vehicle is marked as current, and previously tracked vehicles
  keep their last known position without stale telemetry being presented as
  live

#### Scenario: A reading is unavailable

- **WHEN** the vehicle has no fuel tank part, or the game raises an error for
  one of the readings
- **THEN** that reading is absent from the published telemetry and the
  remaining readings are still published

#### Scenario: Older mod build

- **WHEN** the dashboard receives vehicle data from a mod build that predates
  this telemetry
- **THEN** the dashboard still functions, treating each missing reading as
  unavailable rather than failing to parse the snapshot

### Requirement: Vehicle telemetry is sampled at driving cadence

The mod SHALL sample the vehicle category at a shorter interval while the
player is in a vehicle than while on foot, and SHALL return to the on-foot
interval when the player exits. A player-configured interval SHALL take
precedence, so the driving cadence never publishes more often than the player
asked for.

#### Scenario: Entering a vehicle

- **WHEN** the player enters a vehicle
- **THEN** subsequent vehicle snapshots are published at the driving interval

#### Scenario: Leaving a vehicle

- **WHEN** the player exits a vehicle
- **THEN** vehicle snapshots return to the configured on-foot interval

#### Scenario: Configured interval is respected

- **WHEN** the player has raised the vehicle category's interval in the mod
  options above the driving interval
- **THEN** the configured interval is used

### Requirement: The driving HUD appears only while the player is driving

The dashboard SHALL show the driving HUD while the player is in a vehicle and
SHALL hide it when they are not, without the player having to act.

#### Scenario: Player enters a vehicle

- **WHEN** the dashboard learns the player is in a vehicle
- **THEN** the driving HUD becomes visible over the map

#### Scenario: Player leaves the vehicle

- **WHEN** the dashboard learns the player is no longer in a vehicle
- **THEN** the driving HUD is hidden

#### Scenario: Navigating between screens while driving

- **WHEN** the player is driving and moves between dashboard screens
- **THEN** the driving HUD stays visible and keeps its collapsed or expanded
  state across the navigation

#### Scenario: Telemetry stops arriving

- **WHEN** the player is in a vehicle but no vehicle snapshot has arrived for
  longer than the expected interval
- **THEN** the HUD indicates the readings are stale rather than presenting the
  last values as current

### Requirement: The driving HUD shows the vehicle's readouts

The driving HUD SHALL identify the vehicle and display its speed, its fuel
level, and its engine, headlight, battery and damage state. A reading the mod
did not publish SHALL be shown as unavailable rather than as zero.

#### Scenario: Driving a fuelled vehicle with the engine on

- **WHEN** the player drives a vehicle whose engine is running
- **THEN** the HUD shows the vehicle's name, its current speed with its unit,
  and its fuel level as a proportion of the tank

#### Scenario: Low fuel

- **WHEN** remaining fuel falls below the level at which the game itself warns
  the player
- **THEN** the fuel readout is emphasised as a warning

#### Scenario: Engine off

- **WHEN** the player sits in a vehicle whose engine is not running
- **THEN** the HUD shows the engine as off and does not present a running
  engine's speed as live

#### Scenario: Reading unavailable

- **WHEN** the mod published no value for a reading, such as fuel on a vehicle
  with no tank
- **THEN** that readout is shown as unavailable and the others still display
  their values

#### Scenario: Damaged vehicle

- **WHEN** the vehicle's condition is below full
- **THEN** the HUD shows a damage indicator reflecting that condition

### Requirement: The driving HUD can be turned off from Settings

The dashboard SHALL provide a setting that governs whether the driving HUD may
appear at all. The setting SHALL persist across reloads and SHALL default to
enabled.

#### Scenario: Setting disabled while driving

- **WHEN** the player turns the setting off while the HUD is visible
- **THEN** the HUD disappears immediately and does not reappear on the next
  drive

#### Scenario: Setting re-enabled while driving

- **WHEN** the player turns the setting back on while in a vehicle
- **THEN** the HUD appears again without requiring a reload

#### Scenario: Setting persists

- **WHEN** the player changes the setting and reloads the dashboard
- **THEN** the setting holds the value the player chose

#### Scenario: Default for a new user

- **WHEN** a player who has never opened Settings drives a vehicle
- **THEN** the driving HUD appears

### Requirement: The driving HUD can be collapsed in place

The driving HUD SHALL let the player collapse it to a minimal readout and
expand it again by acting on the HUD itself, without opening Settings. The
collapsed or expanded state SHALL persist across reloads.

#### Scenario: Collapsing

- **WHEN** the player activates the HUD's collapse control while it is
  expanded
- **THEN** the HUD shrinks to a minimal readout that still shows the speed,
  freeing the map area it occupied

#### Scenario: Expanding

- **WHEN** the player activates the control while the HUD is collapsed
- **THEN** the full set of readouts is shown again

#### Scenario: State persists

- **WHEN** the player collapses the HUD, leaves the vehicle, and later drives
  again
- **THEN** the HUD returns collapsed

### Requirement: The driving HUD does not obstruct the map or the existing HUD

The driving HUD SHALL be positioned so that it does not overlap the vitals
cluster, the navigation controls or the hotbar in either the mobile or the
wide handheld layout, and SHALL NOT capture map pan or zoom gestures outside
its own bounds.

#### Scenario: Mobile layout

- **WHEN** the dashboard is shown at the mobile layout width while driving
- **THEN** the driving HUD is fully visible and overlaps none of the vitals
  cluster, the bottom navigation or the hotbar

#### Scenario: Handheld layout

- **WHEN** the dashboard is shown at the wide handheld layout width while
  driving
- **THEN** the driving HUD is fully visible and overlaps none of the vitals
  cluster, the navigation rail or the hotbar

#### Scenario: Map interaction near the HUD

- **WHEN** the player drags or zooms the map starting outside the driving
  HUD's bounds
- **THEN** the map pans or zooms as it does when the HUD is not shown
