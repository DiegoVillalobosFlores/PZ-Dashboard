#!/usr/bin/env bash
# Call the local Penpot MCP server's execute_code tool with a JS snippet from stdin or $1.
# Requires penpot/.env (see .env.example) with PENPOT_MCP_TOKEN set, and the
# Penpot "PZ Companion UI" file open in a browser tab with MCP connected
# (the toolbar's MCP button must show "MCP connected" — the plugin session
# dies when that tab navigates away or closes).
#
# Usage: ./pcall.sh 'penpot.currentPage.name'
#    or: ./pcall.sh - < script.js
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_FILE="$DIR/.mcp-session"

# shellcheck disable=SC1091
source "$DIR/.env"
if [ -z "${PENPOT_MCP_TOKEN:-}" ]; then
  echo "PENPOT_MCP_TOKEN not set — copy penpot/.env.example to penpot/.env and fill it in." >&2
  exit 1
fi

URL="http://localhost:9001/mcp/stream?userToken=${PENPOT_MCP_TOKEN}"

if [ "${1:-}" = "-" ]; then
  CODE=$(cat)
else
  CODE="$1"
fi

SESSION=$(cat "$SESSION_FILE" 2>/dev/null || echo "")

if [ -z "$SESSION" ]; then
  curl -sS -D /tmp/pcall_headers.txt -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"claude-code","version":"0.0.1"}}}' --max-time 15 -o /dev/null
  SESSION=$(grep -i '^mcp-session-id:' /tmp/pcall_headers.txt | sed 's/.*: //' | tr -d '\r')
  echo "$SESSION" > "$SESSION_FILE"
  curl -sS -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: $SESSION" \
    -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' --max-time 10 -o /dev/null
fi

PAYLOAD=$(jq -n --arg code "$CODE" '{jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"execute_code",arguments:{code:$code}}}')

RESULT=$(curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION" \
  -d "$PAYLOAD" --max-time 60)

echo "$RESULT" | sed -n 's/^data: //p' | jq -r '.result.content[0].text // .result // .error // .'
