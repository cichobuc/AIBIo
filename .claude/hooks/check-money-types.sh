#!/usr/bin/env bash
# Advisory: warns when monetary field names use floating-point 'number' type.
# Float arithmetic loses precision on financial values (0.1 + 0.2 ≠ 0.3).
# PreToolUse(Edit|Write) — exit 0 always (advisory only)
set -euo pipefail

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
cat > "$TMPFILE"

read_field() {
    python3 - "$TMPFILE" "$1" <<'PYEOF' 2>/dev/null || true
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
keys = sys.argv[2].split('.')
val = d
for k in keys:
    if isinstance(val, dict):
        val = val.get(k, '')
    else:
        val = ''
        break
sys.stdout.write(str(val) if val is not None else '')
PYEOF
}

TOOL_NAME=$(read_field "tool_name")
FILE_PATH=$(read_field "tool_input.file_path")

if ! echo "$FILE_PATH" | grep -qEe '\.(ts|tsx|js|jsx)$'; then
    exit 0
fi

case "$TOOL_NAME" in
    Edit)  CONTENT=$(read_field "tool_input.new_string") ;;
    Write) CONTENT=$(read_field "tool_input.content") ;;
    *)     exit 0 ;;
esac

MONEY_FIELDS='amount|price|cost|revenue|salary|balance|total|fee|rate|budget|payment|invoice'

FINDINGS=$(echo "$CONTENT" | grep -iEe "($MONEY_FIELDS)\??:\s*number\b" || true)

if [[ -n "$FINDINGS" ]]; then
    echo "ADVISORY [money-types]: Monetary fields using 'number' type in $FILE_PATH"
    echo ""
    echo "$FINDINGS"
    echo ""
    echo "Float precision errors accumulate on financial values."
    echo "Preferred: store as string (serialize from DB), use bigint for cents, or import Decimal.js."
    echo "Add a comment if 'number' is intentional here (e.g. a display percentage)."
fi

exit 0
