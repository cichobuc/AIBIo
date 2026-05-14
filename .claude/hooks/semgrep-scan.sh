#!/usr/bin/env bash
# Runs semgrep security scan on edited TypeScript/JS files.
# PostToolUse(Edit|Write) — exit 0 always (advisory, skips if semgrep not installed)
set -euo pipefail

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
cat > "$TMPFILE"

FILE_PATH=$(python3 - "$TMPFILE" <<'PYEOF' 2>/dev/null || true
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
sys.stdout.write(d.get('tool_input', {}).get('file_path', ''))
PYEOF
)

# Only TypeScript/JavaScript
if ! echo "$FILE_PATH" | grep -qEe '\.(ts|tsx|js|jsx)$'; then
    exit 0
fi

# Skip test files (they intentionally contain exploit strings for SQL injection tests)
if echo "$FILE_PATH" | grep -qEe '(__tests__|\.test\.|\.spec\.)'; then
    exit 0
fi

# Skip if file was deleted
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

# Skip if semgrep not installed
if ! command -v semgrep &>/dev/null; then
    exit 0
fi

RESULT_FILE=$(mktemp)
trap 'rm -f "$TMPFILE" "$RESULT_FILE"' EXIT

semgrep \
    --config "p/typescript" \
    --config "p/secrets" \
    --config "p/owasp-top-ten" \
    --quiet \
    --no-git-ignore \
    --json \
    --output "$RESULT_FILE" \
    "$FILE_PATH" 2>/dev/null || true

COUNT=$(python3 - "$RESULT_FILE" <<'PYEOF' 2>/dev/null || echo "0"
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
print(len(d.get('results', [])))
PYEOF
)

if [[ "$COUNT" -gt 0 ]]; then
    echo "SEMGREP [$COUNT finding(s)] in $FILE_PATH:"
    python3 - "$RESULT_FILE" <<'PYEOF' 2>/dev/null || true
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
for r in d.get('results', []):
    rule = r.get('check_id', '').split('.')[-1]
    line = r.get('start', {}).get('line', '?')
    msg = r.get('extra', {}).get('message', '').split('\n')[0][:120]
    sev = r.get('extra', {}).get('severity', 'INFO').upper()
    print(f'  [{sev}] Line {line}: {rule} — {msg}')
PYEOF
fi

exit 0
