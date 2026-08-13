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

## Compile a redistributable build

```
bun run compile        # single binary for this machine
bun run compile:all    # linux-x64, windows-x64, macos-arm64
```

Both write to `dist/`: the executable(s) and a `.env.example` to copy to
`.env`. Everything the server bundles — the React frontend included — lives
inside the executable; nothing else is shipped, because both the map tiles
and the item icons are read out of the player's own game install at runtime.

To run a build: drop `.env` beside the executable (a compiled build reads
that file as well as the working directory's) and start it. It binds the
port immediately whether or not Project Zomboid is running, and picks up
game state as soon as `PZ_LUA_DIR` appears.

`bun run compile:all` needs cross-target runtimes Bun downloads on demand,
which only exist for released Bun versions — on a canary the foreign targets
are skipped with a warning.

Map tiles are extracted from the game's `spawnSelectImagePyramid.zip` with
`unzip`, falling back to `tar -xf` (which handles zips on Windows 10+ and
macOS) when `unzip` isn't installed.

## Item icons

`GET /game-icons/<TextureName>.png` crops the icon out of the game's own
atlases in `$PZ_INSTALL_DIR/media/texturepacks/*.pack` (`src/icons.ts`), so
no game art is copied into the repo or the shipped build. Index build is a
one-off ~60ms over all packs; cropped icons are cached forever and decoded
atlas pages up to four at a time.

The `.pack` format, little-endian, since it isn't documented anywhere:

```
["PZPK", int32 version]           only in the newer variant
int32 pageCount
per page:
  int32 nameLength, name bytes
  int32 textureCount
  int32 flag
  per texture:
    int32 nameLength, name bytes
    int32 x, y, w, h              rect within the page
    int32 ox, oy, ow, oh          offset and size before trimming
  newer variant: int32 pngLength, PNG bytes
  older variant: PNG bytes (walk chunks to IEND), then 0xDEADBEEF
```

Pages are 8-bit RGBA non-interlaced PNGs; `src/icons.ts` decodes and
re-encodes them with `node:zlib` alone rather than pulling in an image
dependency, which keeps the single-file build honest. Texture packs shipped
by *mods* aren't indexed — only the base game's.

## API

- `GET /api/state` — all categories currently known, as
  `{ [category]: { data, updatedAt } }`
- `GET /api/state/:category` — a single category, 404 if not seen yet
