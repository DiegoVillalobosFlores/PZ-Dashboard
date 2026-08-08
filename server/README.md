# PZ Dashboard server

Bun server that watches the folder the PZDashboard mod (`../mod`) writes
JSON snapshots into, and re-serves the latest state over HTTP. No frontend
yet — this is the plumbing between the mod and the future React dashboard.

## Run

```
bun install
bun run dev
```

By default it watches `~/Zomboid/Lua` (where PZ's `getFileWriter` lands on
Linux/macOS). Override with `PZ_LUA_DIR` if needed — see `.env.example`.

## API

- `GET /api/state` — all categories currently known, as
  `{ [category]: { data, updatedAt } }`
- `GET /api/state/:category` — a single category, 404 if not seen yet
