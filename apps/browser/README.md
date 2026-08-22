# PZ Dashboard Browser Direct

Static dashboard build that reads Project Zomboid files through the File
System Access API. It needs a Chromium desktop browser and a secure origin.
This mode stays on the machine running the game; use `apps/server` for a phone,
tablet or another device.

## Build

```sh
bun install
bun run build
```

Host `dist/` from HTTPS or localhost. The first visit asks for the Zomboid
data directory with read/write access. Map, icon and character screens then
ask for the separate game install directory only when needed. Both handles are
remembered by the browser for later visits.

The data directory contains snapshots and receives
`PZDashboard_command.json`. The game install directory is read-only. Derived
map tiles and decoded icon pages are cached in origin-private storage.
