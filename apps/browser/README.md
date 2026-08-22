# PZ Dashboard Browser Direct

Static dashboard that reads Project Zomboid files through the File System
Access API. It needs a Chromium desktop browser. This mode stays on the
machine running the game; use `apps/server` for a phone, tablet or another
device.

## Build

```sh
bun install
bun run build
```

`dist/index.html` is the whole app — script, stylesheet and file watcher are
all inlined, so it can ship inside the mod and be opened straight from disk
with no server and no network. The build fails rather than emitting a page
that references anything by relative URL, which an opaque origin cannot fetch.

The first visit asks for the Zomboid data directory with read/write access.
Map, icon and character screens then ask for the separate game install
directory only when needed. Both handles are remembered by the browser for
later visits.

The data directory contains snapshots and receives
`PZDashboard_command.json`. The game install directory is read-only.

## Opened from disk vs served

Chrome treats `file://` as a secure context and offers the directory picker
there, so the grant flow is identical either way. One thing differs: `file://`
has no origin-private storage, so derived assets — decoded icon atlas pages,
extracted map tiles — are cached for the session rather than persisted. Every
screen renders the same; the derivation cost is just paid once per session.

Serving the same file over HTTPS or localhost restores persistent caching and
is otherwise unchanged.
