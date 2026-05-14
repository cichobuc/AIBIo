#!/usr/bin/env bash
# Blocks dangerous SQL in bash commands and file writes.
# PreToolUse(Bash): blocks destructive SQL in shell commands.
# PreToolUse(Edit|Write): warns on SQL string interpolation (injection risk).
set -euo pipefail

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
cat > "$TMPFILE"

read_field() {
    # $1 = dot-separated key path, e.g. "tool_input.command"
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
if val is None:
    val = ''
sys.stdout.write(str(val))
PYEOF
}

TOOL_NAME=$(read_field "tool_name")
FILE_PATH=$(read_field "tool_input.file_path")

case "$TOOL_NAME" in
    Bash)  CONTENT=$(read_field "tool_input.command") ;;
    Edit)  CONTENT=$(read_field "tool_input.new_string") ;;
    Write) CONTENT=$(read_field "tool_input.content") ;;
    *)     exit 0 ;;
esac

UPPER=$(echo "$CONTENT" | tr '[:lower:]' '[:upper:]')

# --- DDL destruction ---
if echo "$UPPER" | grep -qEe '\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|SEQUENCE)\b'; then
    echo "BLOCKED [dangerous-sql]: DROP statement detected."
    echo "AIBIo enforces SELECT-only access to source databases."
    exit 2
fi

if echo "$UPPER" | grep -qEe '\bTRUNCATE\s+'; then
    echo "BLOCKED [dangerous-sql]: TRUNCATE detected."
    exit 2
fi

if echo "$UPPER" | grep -qEe '\bALTER\s+TABLE\b.*\bDROP\s+COLUMN\b'; then
    echo "BLOCKED [dangerous-sql]: ALTER TABLE ... DROP COLUMN detected."
    exit 2
fi

# --- DELETE without WHERE ---
if echo "$UPPER" | grep -qEe '\bDELETE\s+FROM\b' && ! echo "$UPPER" | grep -qEe '\bWHERE\b'; then
    echo "BLOCKED [dangerous-sql]: DELETE FROM without WHERE clause."
    exit 2
fi

# --- SQL string interpolation (TypeScript/JS files only) ---
if [[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
    if echo "$FILE_PATH" | grep -qEe '\.(ts|tsx|js|jsx)$'; then
        if echo "$CONTENT" | grep -qPe '`[^`]*(SELECT|INSERT|UPDATE|DELETE|CREATE)[^`]*\$\{' 2>/dev/null; then
            echo "ADVISORY [dangerous-sql]: SQL string interpolation in $FILE_PATH"
            echo "Use parameterized queries or DuckDB identifier quoting (see drizzle-duckdb-specialist agent)."
        fi
    fi
fi

exit 0
