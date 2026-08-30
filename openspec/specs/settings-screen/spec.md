# settings-screen Specification

## Purpose

Defines how the dashboard presents its user preferences: how settings are
grouped and labelled, how a user finds one among many, how they restore
defaults, and how the settings surface adapts between the mobile and handheld
layouts.

## Requirements

### Requirement: Settings are grouped by where they take effect

The settings surface SHALL present every setting inside a named section that
identifies the part of the dashboard the setting affects, and SHALL NOT
present any setting outside a section.

#### Scenario: Sections cover every setting

- **WHEN** the user opens settings with no filter applied
- **THEN** every available setting appears under exactly one section heading
- **AND** each section heading names the area it affects (the map, the
  character render, the skills screen, the condition cluster)

#### Scenario: Condition stat toggles are nested under their parent

- **WHEN** the section for the condition cluster is shown
- **THEN** the individual vitals and conditions toggles appear within that
  section, visually subordinate to the toggle that shows or hides the cluster
  as a whole
- **AND** while the cluster is hidden, the individual toggles are shown as
  inactive and cannot be changed

### Requirement: Settings can be filtered by text

The settings surface SHALL provide a text filter that narrows the visible
settings to those whose title or description contains the entered text,
matched case-insensitively.

#### Scenario: Filter narrows the list

- **WHEN** the user types text that appears in some setting titles or
  descriptions
- **THEN** only the settings whose title or description contains that text
  remain visible
- **AND** sections left with no visible settings are hidden entirely

#### Scenario: Filter matches nothing

- **WHEN** the entered text matches no setting title or description
- **THEN** the surface shows a message stating that no setting matched, rather
  than an empty panel

#### Scenario: Filter is cleared

- **WHEN** the user clears the filter text
- **THEN** all sections and all settings are visible again in their original
  order

#### Scenario: Filtered settings remain operable

- **WHEN** a setting is visible under an active filter
- **THEN** toggling it changes the setting exactly as it would with no filter
  applied

### Requirement: Settings can be reset to their defaults

The settings surface SHALL offer a reset action for each section and a reset
action for all settings, each restoring the affected settings to the values a
first-time user would see.

#### Scenario: Section reset

- **WHEN** the user triggers the reset action of a section
- **THEN** every setting in that section returns to its default value
- **AND** settings in other sections are left unchanged

#### Scenario: Global reset

- **WHEN** the user triggers the reset-all action
- **THEN** every setting on the surface returns to its default value

#### Scenario: Reset is reflected immediately

- **WHEN** a reset restores a setting whose effect is visible elsewhere in the
  dashboard, such as fog of war or the condition cluster
- **THEN** the affected part of the dashboard updates to the restored value
  without requiring a reload

#### Scenario: Reset persists

- **WHEN** the user resets settings and then reloads the dashboard
- **THEN** the settings still hold their default values

### Requirement: Existing settings, keys and defaults are preserved

The redesign SHALL NOT change which settings exist, the values they persist
under, or the value each takes for a user who has never opened settings.

#### Scenario: Stored preferences survive the redesign

- **WHEN** a user who configured settings before the redesign opens the
  dashboard afterwards
- **THEN** each setting holds the value that user had chosen

#### Scenario: Defaults unchanged

- **WHEN** a user with no stored preferences opens the dashboard
- **THEN** fog of war, character rotation, the skills summary, the traits
  list, the condition cluster and all its stat toggles are on, and auto zoom
  while driving is off

### Requirement: The settings surface adapts to the display width

The settings surface SHALL remain a modal panel over the dashboard at every
supported width, and SHALL adapt its internal layout so that all controls stay
reachable without horizontal scrolling.

#### Scenario: Mobile width

- **WHEN** the dashboard is displayed at the mobile layout width
- **THEN** settings are laid out in a single column and the panel scrolls
  vertically when its content exceeds the available height

#### Scenario: Handheld width

- **WHEN** the dashboard is displayed at the wide handheld layout width
- **THEN** the panel widens and lays its sections out across more than one
  column, and the filter and reset-all controls remain visible while the
  sections scroll

#### Scenario: Controls stay reachable

- **WHEN** the panel content is taller than the space the modal frame allows
- **THEN** the content scrolls within the panel and no control is clipped or
  placed outside the visible area
