#!/bin/sh
# Deprecated. chrome-devtools-mcp is configured with --isolated and launches
# its own Chrome (temp profile, cleaned up on exit). Do not start a manual
# --remote-debugging-port=9222 instance for the agent.
#
# Only use this if you personally want a debuggable everyday Chrome:
#   google-chrome-stable --remote-debugging-port=9222 \
#     --user-data-dir="$HOME/.config/google-chrome-devtools"
echo "chrome-debug.sh is deprecated: MCP launches isolated Chrome itself." >&2
echo "See opencode.jsonc mcp.chrome-devtools (--isolated, no --browserUrl)." >&2
exit 1
