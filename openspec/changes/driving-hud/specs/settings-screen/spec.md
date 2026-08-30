## MODIFIED Requirements

### Requirement: Existing settings, keys and defaults are preserved

The redesign SHALL NOT change which settings exist, the values they persist
under, or the value each takes for a user who has never opened settings.
Settings added after the redesign SHALL be listed alongside the existing ones
with their own default.

#### Scenario: Stored preferences survive the redesign

- **WHEN** a user who configured settings before the redesign opens the
  dashboard afterwards
- **THEN** each setting holds the value that user had chosen

#### Scenario: Defaults unchanged

- **WHEN** a user with no stored preferences opens the dashboard
- **THEN** fog of war, character rotation, the skills summary, the traits
  list, the condition cluster and all its stat toggles, and the driving HUD
  are on, and auto zoom while driving is off

#### Scenario: A newly added setting does not disturb stored preferences

- **WHEN** a user who configured settings before the driving HUD toggle
  existed opens the dashboard afterwards
- **THEN** their stored settings are unchanged and the driving HUD toggle
  holds its default
