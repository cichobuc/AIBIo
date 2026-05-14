#!/usr/bin/env bash
# Sends a macOS notification when Claude Code fires a Notification event.
# Notification hook — exit 0 always (side effect only)
set -euo pipefail

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
cat > "$TMPFILE"

MESSAGE=$(python3 - "$TMPFILE" <<'PYEOF' 2>/dev/null || echo "Task complete"
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
msg = d.get('message', 'Task complete')
# Truncate to 200 chars for readability
sys.stdout.write(msg[:200])
PYEOF
)

# Escape single quotes for AppleScript string literal
ESCAPED="${MESSAGE//\'/\'}"

osascript \
    -e 'on run argv' \
    -e '  display notification (item 1 of argv) with title "Claude Code" sound name "Ping"' \
    -e 'end run' \
    -- "$ESCAPED" 2>/dev/null || true

exit 0
