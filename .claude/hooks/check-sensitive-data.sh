#!/usr/bin/env bash
# Blocks writing hardcoded secrets, API keys, or credentials to files.
# PreToolUse(Edit|Write) — exit 2 on detection (hard block)
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

# Whitelist: .env.example is the template file — placeholders only
if echo "$FILE_PATH" | grep -qEe '(\.env\.example|\.gitignore)$'; then
    exit 0
fi

case "$TOOL_NAME" in
    Edit)  CONTENT=$(read_field "tool_input.new_string") ;;
    Write) CONTENT=$(read_field "tool_input.content") ;;
    *)     exit 0 ;;
esac

BLOCKED=""

# Anthropic API key
if echo "$CONTENT" | grep -qEe 'sk-ant-api[0-9]+-[-A-Za-z0-9_]{20,}' 2>/dev/null; then
    BLOCKED+="  [anthropic-key] Anthropic API key (sk-ant-api...) detected\n"
fi

# GitHub Personal Access Token
if echo "$CONTENT" | grep -qEe '(ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{80,})' 2>/dev/null; then
    BLOCKED+="  [github-token] GitHub PAT (ghp_... or github_pat_...) detected\n"
fi

# PEM private key — optional prefix, no empty alternatives
if echo "$CONTENT" | grep -qEe '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' 2>/dev/null; then
    BLOCKED+="  [private-key] PEM private key detected\n"
fi

# Hardcoded password: password/passwd/pwd = "literal" (case-insensitive, 4+ chars)
if echo "$CONTENT" | grep -qiEe "(password|passwd|pwd)[[:space:]]*[=:][[:space:]]*['\"][^'\"[:space:]]{4,}['\"]" 2>/dev/null; then
    BLOCKED+="  [hardcoded-password] Hardcoded password string detected\n"
fi

# MotherDuck token
if echo "$CONTENT" | grep -qEe 'md_[-A-Za-z0-9_]{20,}' 2>/dev/null; then
    BLOCKED+="  [motherduck-token] MotherDuck token (md_...) detected\n"
fi

# Database connection string with embedded credentials
if echo "$CONTENT" | grep -qEe '(postgres|postgresql|mysql|mssql)://[^:]+:[^@[:space:]]+@' 2>/dev/null; then
    BLOCKED+="  [connection-string] DB connection string with credentials detected\n"
fi

# AIBIO_ENCRYPTION_KEY with literal base64 value (not a placeholder)
if echo "$CONTENT" | grep -qEe 'AIBIO_ENCRYPTION_KEY[[:space:]]*=[[:space:]]*[A-Za-z0-9+/=]{40,}' 2>/dev/null; then
    if ! echo "$CONTENT" | grep -qiEe 'AIBIO_ENCRYPTION_KEY[[:space:]]*=[[:space:]]*(your|<|YOUR|placeholder)' 2>/dev/null; then
        BLOCKED+="  [encryption-key] AIBIO_ENCRYPTION_KEY literal value detected\n"
    fi
fi

if [[ -n "$BLOCKED" ]]; then
    echo "BLOCKED [sensitive-data]: Secrets detected in $FILE_PATH"
    echo ""
    echo -e "$BLOCKED"
    echo "All secrets must live in .env (gitignored). Reference via process.env.VARIABLE_NAME."
    echo "See .env.example for all required environment variables."
    exit 2
fi

exit 0
