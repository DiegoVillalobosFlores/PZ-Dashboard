#!/bin/sh
# Launch Chrome with remote debugging enabled on port 9222.
# The chrome-devtools MCP server connects to this instance.
# Close any existing Chrome windows first, or use a separate profile:
#   google-chrome-stable --remote-debugging-port=9222 --user-data-dir="$HOME/.config/google-chrome-devtools"

exec google-chrome-stable --remote-debugging-port=9222 "$@"
