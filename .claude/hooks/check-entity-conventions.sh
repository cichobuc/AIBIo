#!/usr/bin/env bash
# Advisory: checks TypeScript entity conventions for AIBIo.
# Flags: `any` type, `var` declarations, console.log in production,
# non-kebab-case MCP tool names, non-snake_case Drizzle table names.
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

IS_TEST=0
if echo "$FILE_PATH" | grep -qEe '(__tests__|\.test\.|\.spec\.|/test/)'; then
    IS_TEST=1
fi

case "$TOOL_NAME" in
    Edit)  CONTENT=$(read_field "tool_input.new_string") ;;
    Write) CONTENT=$(read_field "tool_input.content") ;;
    *)     exit 0 ;;
esac

WARNINGS=""

# 1. `any` type — TypeScript strict violation
if [[ $IS_TEST -eq 0 ]]; then
    if echo "$CONTENT" | grep -qEe ':\s*any\b|<any>|as\s+any\b'; then
        WARNINGS+="  [any-type] 'any' type detected. CLAUDE.md: TypeScript strict, no 'any'.\n"
        WARNINGS+="    Use 'unknown' + type narrowing, or define a specific interface.\n\n"
    fi
fi

# 2. `var` declarations
if echo "$CONTENT" | grep -qEe '^\s*var\s+'; then
    WARNINGS+="  [var-decl] 'var' declaration. Use 'const' or 'let'.\n\n"
fi

# 3. console.log/debug/info in production code
if [[ $IS_TEST -eq 0 ]]; then
    if echo "$CONTENT" | grep -qEe 'console\.(log|debug|info)\('; then
        WARNINGS+="  [console-log] console.log/debug/info in production code. Remove before commit.\n"
        WARNINGS+="    For AI stream debugging: sseEmitter.emit(workspaceId, { type: 'stream_error', message })\n\n"
    fi
fi

# 4. MCP tool name must be kebab-case
if echo "$CONTENT" | grep -qEe 'registerTool\('; then
    BAD=$(echo "$CONTENT" | grep -oEe "name:\s*['\"][^'\"]+['\"]" | grep -vEe "name:\s*['\"][a-z][a-z0-9-]*['\"]" || true)
    if [[ -n "$BAD" ]]; then
        WARNINGS+="  [tool-name] MCP tool name not kebab-case: $BAD\n"
        WARNINGS+="    Required: lowercase-kebab-case (e.g. 'explore-schema', 'write-model').\n\n"
    fi
fi

# 5. `as unknown as X` double-cast
if echo "$CONTENT" | grep -qEe 'as\s+unknown\s+as\b'; then
    WARNINGS+="  [double-cast] 'as unknown as X' bypasses TypeScript type system.\n"
    WARNINGS+="    Use a type guard or a typed generic instead.\n\n"
fi

# 6. Drizzle table name must be snake_case
if echo "$CONTENT" | grep -qEe 'sqliteTable\('; then
    BAD=$(echo "$CONTENT" | grep -oEe "sqliteTable\(['\"][^'\"]+['\"]" | grep -vEe "sqliteTable\(['\"][a-z][a-z0-9_]*['\"]" || true)
    if [[ -n "$BAD" ]]; then
        WARNINGS+="  [table-name] Drizzle table name not snake_case: $BAD\n"
        WARNINGS+="    Required: lowercase_snake_case (e.g. 'table_profiles', 'chat_messages').\n\n"
    fi
fi

if [[ -n "$WARNINGS" ]]; then
    echo "ADVISORY [entity-conventions]: Convention issues in $FILE_PATH"
    echo ""
    echo -e "$WARNINGS"
fi

exit 0
