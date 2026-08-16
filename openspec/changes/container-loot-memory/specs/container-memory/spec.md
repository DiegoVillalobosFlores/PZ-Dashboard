## Purpose

Keeps a per-save record of what each world container held the last time the character stood next to it, so a player can search their own looting history by item and see remembered containers on the map instead of relying on notes or memory.

## ADDED Requirements

### Requirement: Recording sightings

The dashboard SHALL record every world container reported by the game, together with its position, its contents at that moment, and when the sighting happened.

#### Scenario: A container comes into range

- **WHEN** the game reports a world container the dashboard has not recorded before
- **THEN** the container is recorded with its position, kind, name, lock state, contents, and the in-game day and hour of the sighting

#### Scenario: A remembered container is seen again

- **WHEN** the game reports a container that is already recorded
- **THEN** the recorded contents are replaced by the contents just reported, not merged with them
- **AND** the sighting time is updated

#### Scenario: A remembered container is now empty

- **WHEN** a container that was recorded with contents is reported with no items
- **THEN** it is recorded as empty and no longer matches searches for the items it used to hold

#### Scenario: Containers that are not remembered

- **WHEN** the game reports the player's own inventory, a bag the player is carrying, or a vehicle's storage
- **THEN** no sighting is recorded for it

#### Scenario: Contents unchanged since the last sighting

- **WHEN** a container is reported repeatedly with contents identical to what is already recorded
- **THEN** the record is not rewritten on every report

### Requirement: Per-save scoping

Recorded sightings SHALL belong to the save they were observed in, and SHALL never be returned for a different save.

#### Scenario: Switching to another save

- **WHEN** the player loads a different save and queries the memory
- **THEN** only sightings recorded in that save are returned

#### Scenario: The save is not known

- **WHEN** a container snapshot arrives while the current save is unknown
- **THEN** no sighting is recorded, rather than being recorded against an unknown or shared save

### Requirement: Container identity

A remembered container SHALL be identified by something stable across sightings, so that returning to a place updates the existing record instead of creating a duplicate.

#### Scenario: Returning to a previously seen container

- **WHEN** the player leaves a container's area and later returns to it
- **THEN** the same record is updated, and the map shows one container at that position rather than several

#### Scenario: Two containers of the same kind on one square

- **WHEN** a single map square holds more than one container of the same type
- **THEN** each is recorded separately rather than overwriting the other

#### Scenario: Live container addressing is unaffected

- **WHEN** the player selects a container or moves items between containers
- **THEN** the behaviour is unchanged by the existence of the memory

### Requirement: Querying the memory

The dashboard SHALL let the player search remembered containers by item text and retrieve those within a map area.

#### Scenario: Searching by item

- **WHEN** the player searches for item text
- **THEN** the results are containers whose remembered contents match that text, each with its position, name, and when it was last seen
- **AND** results are ordered with the most recently seen first

#### Scenario: Nothing matches

- **WHEN** a search matches no remembered contents
- **THEN** an empty result is returned and the interface says so, rather than showing an error

#### Scenario: Querying a map area

- **WHEN** remembered containers are requested for a bounding box
- **THEN** only containers inside that box, for the current save, are returned

### Requirement: Forgetting

The player SHALL be able to discard remembered sightings.

#### Scenario: Forgetting one container

- **WHEN** the player forgets a single remembered container
- **THEN** it stops appearing in searches and on the map, until it is seen again

#### Scenario: Forgetting a whole save

- **WHEN** the player clears the memory for the current save
- **THEN** every sighting for that save is discarded and sightings for other saves are untouched

### Requirement: Map display

Remembered containers SHALL be displayable on the map, under the player's control.

#### Scenario: Turning the layer on

- **WHEN** the player enables the remembered-container layer
- **THEN** containers remembered within the visible map area are drawn on the map
- **AND** each shows its name and when it was last seen

#### Scenario: Default state

- **WHEN** a player has never set the layer preference
- **THEN** the layer is off

#### Scenario: Focusing a search result

- **WHEN** the player picks a container from the search results
- **THEN** the map centres on that container's position

#### Scenario: Sightings the player cannot currently see

- **WHEN** a remembered container lies in an area hidden by fog of war
- **THEN** it is still shown, because the record is of somewhere the character has already been
