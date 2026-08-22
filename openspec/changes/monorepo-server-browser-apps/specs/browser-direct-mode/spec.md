## Purpose

Lets a player run the whole dashboard as a static web page with no companion
process, by granting the browser direct access to the game's snapshot files
and installed assets on the same machine.

## ADDED Requirements

### Requirement: Ships as one file the mod can carry

The Steam Workshop distributes files, not processes, so the build SHALL emit a
single self-contained HTML file that runs when opened directly from the mod
folder, with no server, no install step and no network access. It SHALL NOT
reference any script, stylesheet or worker by relative URL, because an opaque
origin cannot fetch them.

#### Scenario: Opened from the mod folder

- **WHEN** a subscriber opens the shipped HTML file directly from disk
- **THEN** the dashboard boots and asks for the Zomboid data directory
- **AND** no request is made for any script, stylesheet or worker file

#### Scenario: Build emits a stray reference

- **WHEN** the build would leave a relative script or stylesheet reference in
  the page
- **THEN** the build fails rather than shipping a page that cannot start

### Requirement: Capability detection before anything else

The browser app SHALL determine, before requesting any directory access,
whether the current browser can grant persistent read-write access to a
user-chosen local directory. When it cannot, the app SHALL present a clear
explanation naming the server app as the supported alternative, and SHALL NOT
present a directory picker or a partially working dashboard.

#### Scenario: Unsupported browser

- **WHEN** the app is opened in a browser without File System Access directory
  support
- **THEN** it displays an unsupported-browser notice that names the server app
  as the way to run the dashboard in that browser
- **AND** no directory picker is shown

#### Scenario: Insecure context

- **WHEN** the app is served over a non-secure origin
- **THEN** it reports that a secure origin is required and does not prompt for
  any directory

### Requirement: Two independent directory grants, requested lazily

The app SHALL require two separate directory grants: the Zomboid data
directory with read and write access, and the game install directory with read
access. It SHALL request the data directory first and SHALL NOT request the
install directory until a screen needs an asset that comes from it.

#### Scenario: First run

- **WHEN** a first-time user opens the app
- **THEN** the app asks only for the Zomboid data directory
- **AND** once granted, live vitals, skills, inventory and equipment render
  without any further prompt

#### Scenario: Install directory requested on demand

- **WHEN** the user first opens a screen that needs map tiles, item icons or
  the character model
- **THEN** the app explains what the install directory is for and asks for it
- **AND** the rest of the dashboard keeps working while that request is
  pending

#### Scenario: Wrong directory chosen

- **WHEN** the user grants a directory that does not contain the expected
  contents
- **THEN** the app reports which directory it expected and what it looked for
- **AND** offers to pick again without discarding the other, valid grant

#### Scenario: Install directory offered as the data directory

- **WHEN** the user answers the first prompt with the game install directory
- **THEN** the app says so by name rather than appearing to wait for the game
- **AND** states that the install directory is asked for separately, later

#### Scenario: Data directory the mod has not written to yet

- **WHEN** the granted directory is a Zomboid data directory holding no
  snapshots because the game has not run with the mod
- **THEN** the app accepts it rather than rejecting it as the wrong folder

### Requirement: Grants persist across sessions

The app SHALL remember granted directories between visits and SHALL restore
them without asking the user to locate the folders again. When the browser has
revoked the permission but retained the location, the app SHALL ask only to
re-confirm access, not to re-pick the directory.

#### Scenario: Return visit with permission intact

- **WHEN** a returning user opens the app and the browser has retained the
  grant
- **THEN** the dashboard connects with no picker and no confirmation prompt

#### Scenario: Return visit with permission lapsed

- **WHEN** a returning user opens the app and the browser has dropped the
  permission but retained the remembered location
- **THEN** the app asks the user to re-confirm access to that same location
- **AND** does not require the user to navigate the file picker again

### Requirement: Same URL contract as the server app

Every state, asset and action surface the server app exposes over HTTP SHALL
be reachable at the same paths in the browser app, so that the shared frontend
runs unmodified against either. Responses SHALL be equivalent in content type
and status semantics, including the not-found and bad-request cases.

#### Scenario: Asset request

- **WHEN** the frontend requests an item icon, a map tile, a map region query
  or the character figure by its usual path
- **THEN** the browser app returns the same shape of response the server app
  returns for that path

#### Scenario: Unknown category

- **WHEN** the frontend requests a state category the mod has not yet written
- **THEN** the browser app responds with the same not-found status the server
  app uses

### Requirement: Live state tracks the mod at the same cadence

The app SHALL detect updated snapshot files and publish them to the dashboard
at the same polling cadence the server app uses, SHALL replay the most recent
snapshot of each category to any screen that subscribes later, and SHALL do
its file polling off the main thread so map marker easing is not disturbed.

#### Scenario: Snapshot updated while playing

- **WHEN** the mod writes a new snapshot for a category
- **THEN** the dashboard reflects it within one poll interval

#### Scenario: Screen mounted after a snapshot arrived

- **WHEN** the user navigates to a screen whose category last updated before
  that screen mounted
- **THEN** the screen renders the retained snapshot immediately rather than
  showing an empty state

#### Scenario: Game not running

- **WHEN** the data directory is granted but contains no snapshot files
- **THEN** the app reports that it is waiting for the game rather than showing
  an error
- **AND** begins rendering as soon as the mod writes its first snapshot

### Requirement: Actions are written back to the mod

The app SHALL write the mod's command file into the granted data directory
when the user triggers an action, SHALL acknowledge the action to the UI on
write, and SHALL surface the mod's later result the same way the server app
does. When the data directory grant is read-only, actions SHALL be disabled
with a stated reason rather than failing silently.

#### Scenario: Action succeeds

- **WHEN** the user triggers an action such as dropping or equipping an item
- **THEN** the command is written to the data directory and the UI
  acknowledges it
- **AND** the outcome appears when the mod reports its result

#### Scenario: Write access unavailable

- **WHEN** the data directory was granted read-only
- **THEN** action controls are disabled and the app states that write access
  is required

### Requirement: Extracted and derived assets are cached locally

The app SHALL cache expensive derived assets — extracted map tiles, decoded
icon atlas pages — in local browser storage so the extraction cost is paid
once rather than per session. It SHALL remain usable while a first extraction
is in progress, and SHALL recover from a cleared or evicted cache by
re-extracting. Where the origin has no private file system — which is the
case when the app is opened from `file://`, the form the mod ships — the app
SHALL fall back to a per-session cache and remain correct, paying the
derivation cost once per session instead of once per install.

#### Scenario: First map view

- **WHEN** the user opens the map for the first time after granting the
  install directory
- **THEN** the app indicates that tiles are being prepared and renders them as
  they become available

#### Scenario: Subsequent sessions

- **WHEN** the user opens the map in a later session with the cache intact
- **THEN** tiles render without re-extracting

#### Scenario: Cache evicted by the browser

- **WHEN** the browser has evicted the cached assets
- **THEN** the app re-extracts them transparently rather than erroring

#### Scenario: Origin has no private file system

- **WHEN** the app runs from an origin where origin-private storage is refused
- **THEN** it derives assets into a per-session cache instead of failing
- **AND** every screen renders the same as it does with persistent storage

### Requirement: Local-only by design

The browser app SHALL operate entirely against the local machine and SHALL NOT
serve the dashboard to any other device. It SHALL make this limit explicit
where a user would reasonably expect second-device access, and SHALL NOT
transmit any file it reads to a remote origin.

#### Scenario: User looks for a phone connection

- **WHEN** the user looks for a way to open the dashboard on a phone or
  handheld
- **THEN** the app states that this mode runs only on the machine running the
  game and points to the server app for second-device use

#### Scenario: No outbound transmission

- **WHEN** the app reads game files
- **THEN** no part of their contents is sent to any remote origin
