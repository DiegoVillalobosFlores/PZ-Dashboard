# Penpot (self-hosted, via Podman)

Local Penpot instance used to design the companion UI, since it's free/self-hosted
and exposes an MCP server the same way Figma does. Login: http://localhost:9001.

## Run

```
cp .env.example .env   # fill in PENPOT_SECRET_KEY (see comment in the file) and PENPOT_MCP_TOKEN
uvx podman-compose up -d
```

`.env` is gitignored — it holds the Penpot instance's master secret key and
the MCP auth token, neither of which belong in git.

## MCP

The Penpot MCP server is enabled (`enable-mcp` flag) and reachable at
`http://localhost:9001/mcp/stream?userToken=...`. It's registered with Claude
Code as the `penpot` MCP server (`claude mcp list`), but Claude Code only
loads MCP servers at session startup, so a session started before the server
was registered won't see its tools via the normal tool interface.

`pcall.sh` is a workaround/fallback that talks to the same server directly
over HTTP (same JSON-RPC the native tool would use), for use from Bash when
the native tool isn't available in the current session:

```
./pcall.sh 'penpot.currentPage.name'
./pcall.sh - < script.js
```

Requires the "PZ Companion UI" file open in a browser tab with the toolbar's
MCP button showing "MCP connected" — that connection is a live plugin
session tied to the tab, and dies if the tab navigates away or closes.

## Known issue: exporter can't render screenshots

`export_shape` (and therefore visual screenshots via MCP) fails because the
`penpot-exporter` container tries to reach `http://localhost:9001/render.html`
using its own container-local `localhost`, which isn't the frontend. Not yet
fixed — see conversation history / commit log for the planned fix (giving the
stack a shared hostname via `/etc/hosts` instead of `localhost`). Until then,
verify visual results by opening http://localhost:9001 in a real browser
rather than via `export_shape`.
