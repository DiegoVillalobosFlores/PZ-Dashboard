#!/usr/bin/env bash
# Like pcall.sh, but prepends helpers.js first so storage.* helpers are
# always available even if the plugin session reset since the last call.
# Usage: ./pcallh.sh - < script.js
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "${1:-}" = "-" ] || [ -z "${1:-}" ]; then
  CODE=$(cat)
else
  CODE="$1"
fi
{ cat "$DIR/helpers.js"; printf '%s\n' "$CODE"; } | "$DIR/pcall.sh" -
