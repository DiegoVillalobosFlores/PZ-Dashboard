---
name: penpot-local
description: How to run and drive this project's self-hosted Penpot instance (Podman) for UI design work — starting the stack, connecting the MCP server, the Plugin API gotchas already discovered, and the on-canvas versioning convention. Use whenever asked to create, edit, or continue UI/UX design/mockup work for this project, or when Penpot is mentioned.
---

# Penpot (self-hosted, local design tool)

This project uses a **self-hosted Penpot instance via Podman** as its design
tool instead of Figma — Figma's MCP tool-call quota on the free/Starter plan
was exhausted mid-project, and Penpot is free, self-hosted, and exposes an
equivalent MCP server. All UI design work for the PZ Dashboard companion app
lives in one Penpot file, driven primarily through its MCP server rather
than manual clicking.

Everything referenced below lives in `penpot/` in this repo:
`docker-compose.yaml`, `.env` (gitignored — copy `.env.example`), `pcall.sh`,
`pcallh.sh`, `helpers.js`, `README.md`.

## 1. Start the stack

```
cd penpot
cp .env.example .env   # first time only — fill in PENPOT_SECRET_KEY (see comment in the file)
uvx podman-compose up -d
```

Podman on this machine doesn't resolve unqualified image names (no
`registries.conf`), which is why every image in `docker-compose.yaml` is
fully qualified (`docker.io/...`) — don't revert that.

Penpot is then at **http://localhost:9001**. Login is in `penpot/.env`
(`PENPOT_ACCOUNT_EMAIL` / `PENPOT_ACCOUNT_PASSWORD`) — a local dev-only
account, not exposed to the internet.

The design file: project **"PZ Companion"**, file **"PZ Companion UI"**.
Direct link:
`http://localhost:9001/#/workspace?team-id=6f5e0bb8-44c6-815d-8008-7048d1442e7b&file-id=6f5e0bb8-44c6-815d-8008-7049c31e760a&page-id=6f5e0bb8-44c6-815d-8008-7049c31e760b`

## 2. Connect to the MCP server

The Penpot MCP server is enabled (`enable-mcp` flag in the compose file) and
already registered with Claude Code as the `penpot` MCP server (user scope —
check with `claude mcp list`). **Claude Code only loads MCP servers at
session startup**, so a session that was already running when this was set
up (or any fresh session that hasn't reloaded yet) won't see the native
`mcp__penpot__*` tools even though the server is connected and healthy.

**Fallback that always works, regardless of native-tool availability:**
`penpot/pcall.sh` talks to the exact same MCP server directly over HTTP
(same JSON-RPC the native tool would use):

```
cd penpot
./pcall.sh 'penpot.currentPage.name'          # inline script
./pcall.sh - < script.js                       # from a file
./pcallh.sh - <<'EOF'                          # prepends helpers.js first (see §4)
...
EOF
```

**Before any of this works, the design file must be open in a real browser
tab with the plugin actively connected**: navigate to the file URL above,
click the **MCP** button in the toolbar until it shows "MCP connected". This
connection is a live session tied to that specific tab — it dies if the tab
navigates away, reloads, or the browser process restarts (which also loses
the login cookie, so you may need to log back in first). If a `pcall.sh`
call returns `No plugin instance connected for user token`, that's why —
go reconnect the tab.

If you have real browser tooling available (e.g. `chrome-devtools` MCP
tools), drive that browser directly rather than asking the user to click
around — navigate to the file URL, log in if needed, click MCP to
reconnect, then resume calling `pcall.sh`/`pcallh.sh`.

**Also check the whole Podman stack is actually running** before assuming
a connection problem — `podman ps -a --filter name=penpot`. Rootless Podman
containers can all stop together (system sleep, session end); `cd penpot &&
uvx podman-compose up -d` brings them back with the same data (named
volumes persist across restarts, same project name).

**`No plugin instance connected for user token` doesn't always mean the
plugin is actually disconnected** — `pcall.sh` caches an MCP session ID in
`penpot/.mcp-session` and reuses it across calls. If the Penpot stack
restarted (or the plugin reconnected) since that file was written, the
cached session ID is dead even though the UI shows "MCP connected" and a
*fresh* session would work fine. **Before concluding the plugin is
disconnected, `rm -f penpot/.mcp-session` and retry once** — that alone
fixes it far more often than actually needing to re-click MCP in the
browser.

## 3. Visual verification — `export_shape` is broken here

`export_shape` (and therefore any MCP-driven screenshot) fails in this
local stack: the `penpot-exporter` container tries to reach
`http://localhost:9001/render.html` using its own container-local
`localhost`, which isn't the frontend container → `ERR_CONNECTION_REFUSED`.
Not fixed (would need a shared hostname added to `/etc/hosts` plus a
`PENPOT_PUBLIC_URI` change, which needs the user's sign-off since it edits
a system file).

**Workaround: verify visually through the same browser tab directly** —
use `chrome-devtools`'s `take_screenshot` after `penpot.viewport.zoomIntoView([shape])`
(call that via `pcall.sh`, it's a real Plugin API method) rather than
relying on `export_shape`.

## 4. Plugin API gotchas already paid for — don't rediscover these

The plugin's JS `storage` object (and anything attached to it) **resets
whenever the browser tab reloads/reconnects** — never assume a helper
defined in one `pcall.sh` call survives to the next. `penpot/helpers.js`
holds every reusable helper (icon creation, text creation, token/color
application, the version-grid helpers) and gets **re-prepended to every
call** via `pcallh.sh` — use `pcallh.sh`, not raw `pcall.sh`, for anything
beyond a one-line read.

**The MCP server kills any single `execute_code` call at 30 seconds**, but
the plugin keeps running the script to completion in the browser — so a
timeout error usually means "still working", not "failed". Don't re-run the
call (you'll duplicate everything); wait, then read the canvas back to see
how far it got. Anything heavier than one screen per call (e.g.
`cloneVersionRow`, or rebuilding several boards in a loop) will trip this,
so split multi-board work into one call per board.

Hard-won API gotchas (Penpot's Plugin API, not the same as Figma's):

- **An icon instance appended to a flex container can have its glyph paths
  stranded** at the position the board occupied before the layout moved it:
  `iconBoard.x/.y` read correctly but the paths draw somewhere else (or
  vanish, once the board clips). Worse with `justifyContent: "center"`.
  Every Lucide instance carries a `base-background` rect that spans the
  board exactly, so the drift is measurable — `storage.reseatIcon(board)` /
  `storage.reseatIconsIn(root)` shift the children back by
  board-minus-base. Call the latter at the end of any flex-heavy build.
- **Frosted-glass panels want `blur = { type: "background-blur", value: N }`**
  — that's the backdrop blur. `"layer-blur"` is also valid but smears the
  panel's own icons and text. (`"backdrop-blur"` throws.)
- **`applyToken(...)` then lowering `fillOpacity` doesn't stick** — the
  token binding re-resolves to full opacity, so the shape ships solid. For
  a tinted wash (e.g. an 18%-accent "selected" state) set a raw
  `fills = [{ fillColor, fillOpacity }]` instead of a token. (This is why
  v11's selected container cards render as solid orange.)
- `penpot.createText()` **requires the initial string as an argument**:
  `penpot.createText("hello")`. Zero-arg throws `Value not valid. Code: :createText`.
- `applyToken(token, [props])` for a `borderRadius`-type token **must name
  explicit corners** (`"borderRadiusTopLeft"`, etc.) — `"all"` is not a
  valid prop for that token type and throws a generic, unhelpful error.
  `"all"` *is* valid for other token types (dimension, spacing).
- **Resizing a component instance does not proportionally scale its
  children** unless each child's `constraintsHorizontal`/`constraintsVertical`
  is explicitly set to `"scale"` *before* the resize — the default is
  fixed-position, so children silently stay at native size and get clipped
  by the now-smaller frame. This is why every icon must go through
  `storage.iconInstance(name, size, colorToken)` (sets constraints, then
  resizes) rather than `component.instance()` + `.resize()` by hand. To fix
  an already-broken instance in place, use `storage.fixIconScale(iconBoard)`.
- **Component instance children are protected** — `.remove()`/`insertChild()`
  on a descendant of an unmodified instance is a silent no-op — until you
  call `instance.detach()` first.
- **Never compare shapes across separate `execute_code` calls with `===`**
  — each call returns fresh JS objects for the same underlying node.
  Compare by `.id` (e.g. `a.parent.id === b.id`), not object identity.
- `GridLayout.rows` / `.columns` are **read-only getters** — add tracks with
  `grid.addRow(type, value)` / `grid.addColumn(type, value)`, never direct
  assignment.
- **Prototype interactions**: `open-overlay`/`toggle-overlay` with a named
  `position` (e.g. `"bottom-center"`) reliably throws `Value not valid` in
  this Penpot version's plugin bridge, even with `relativeTo` set. Use
  `position: "manual"` with an explicit `manualPositionLocation: {x, y}`
  instead — always works, and gives exact control anyway.
- Multi-step builds: work in small `pcallh.sh` calls (one section at a
  time), `await new Promise(r => setTimeout(r, 150))` after structural
  changes before reading computed `.width`/`.height` (layout needs a tick to
  settle), and `penpot.viewport.zoomIntoView([...shapes])` + a screenshot to
  sanity-check before moving on.
- **`resize()` silently resets `growType` to `"fixed"`** — if you want
  `"auto-height"`/`"auto-width"` text, set `growType` *after* `resize()`,
  never before. Even then, auto-height on a multi-line paragraph can take
  longer than a short `setTimeout` to resolve (seen taking >250ms, reliable
  by 500ms) — if `.height` still reads as your placeholder value (e.g. `10`)
  right after building, wait longer and re-read before concluding it's
  broken; don't assume the fix didn't work.

## 5. Design system already in place

- **Design tokens** (real Penpot tokens, not hardcoded values): a dark,
  Mantine-inspired palette plus spacing/radius scales, set "PZ Companion".
  Apply via `storage.applyColor(shape, "color.accent.primary", "fill")`,
  `storage.applyRadius(shape, "radius.md")`, etc. — never hardcode a hex or
  pixel value where a token exists.
- **Icons**: the official **Lucide Icons** library (1420 real icons) is
  connected to the file. Use `storage.icon("wrench")` /
  `storage.iconInstance("wrench", 24, "color.text.primary")` — never
  hand-draw an icon.
- **Reusable components** already built: Badge, ProgressBar, ListItem,
  ToolbarSlot, SkillRow, StatusRail, TabBarItem (Active/Inactive variant).
  Look them up with `storage.libComp("Badge")` before building a new one.
- **Visual language**: floating translucent "glass" HUD panels
  (`fillOpacity` ~0.6–0.75, thin orange-tinted border, drop shadow) over a
  fullscreen map background, sharp/angular corners (radius tokens were
  deliberately shrunk for a tactical-HUD feel, not a soft app feel),
  uppercase + letter-spacing on nav labels and section headers, orange
  (`color.accent.primary`) glow on active/selected elements. Match this,
  don't reintroduce soft rounded "app" chrome.

## 6. Versioning convention — never edit a shipped design in place

**Every revision is a new row on the canvas, never an edit to an existing
one.** Y axis = version number, oldest at the top (`y=0`), each new version
further down. X axis = screen/artifact type, and every screen type keeps
the **same column** (X position) across every version row, so you can scan
across a row to see one version's full set of screens, or down a column to
see one screen's history.

Be very consice and don't write too many things in the handover. Just get to the point of what changes on every version and why it was done that way.

Don't recreate each screen for every version — just create the new or updated screens as needed.

- `storage.versionColumns` (in `helpers.js`) is the ordered list of
  `{ key, width }` columns. **Add a new entry when introducing a new screen
  type** (as happened for the Health/Equipment page) — append, don't
  reorder existing ones, or every prior version's columns shift.
- `storage.cloneVersionRow(fromVersion, toVersion, rowHeight)` clones every
  known board from `fromVersion` into a fresh row at `toVersion`, in the
  same columns, and leaves the source version completely untouched. Call
  this first, then edit only the returned clones. For a column that's new
  in this version (no prior source), it returns `null` for that key — build
  it fresh directly into that column's position
  (`storage.versionColumnX(colIndex)`, `storage.versionRowY(version, rowHeight)`).
  A "VERSION N" label is added automatically.
- **Every row has a handover text panel in a dedicated column to the left
  of the screens** (`storage.handoverWidth`/`storage.handoverGap` reserve
  that space; `storage.versionColumnX` already accounts for it, so screen
  columns don't need to change). Build it with
  `storage.addHandover(version, rowHeight, { whatChanged, userStory, screens })`
  — `screens` is an array of `{ name, explanation }` covering every screen
  in that row in plain English. Author this fresh per version (it's
  narrative, never cloned) and do it for every version, no exceptions.
- Legacy screens that predate this convention (the original tab-based
  Map/Inventory/Toolbar/Skills, before the floating-HUD redesign) live far
  below everything at `y=10000`, clearly labeled "LEGACY — superseded" —
  they are archived reference, not part of version history. Don't fold them
  in or extend them.
