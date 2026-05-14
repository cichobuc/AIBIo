#!/usr/bin/env bash
# Blocks destructive git operations that are hard to undo.
# PreToolUse(Bash)
set -euo pipefail

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
cat > "$TMPFILE"

COMMAND=$(python3 - "$TMPFILE" <<'PYEOF' 2>/dev/null || true
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
sys.stdout.write(d.get('tool_input', {}).get('command', ''))
PYEOF
)

if ! echo "$COMMAND" | grep -qe '\bgit\b'; then
    exit 0
fi

# --- Force push ---
if echo "$COMMAND" | grep -qEe 'git\s+push.*(--force|-f)\b'; then
    echo "BLOCKED [destructive-git]: Force push detected."
    echo "Force pushing rewrites remote history."
    echo "Use 'git commit --amend' locally, or coordinate with the team before force-pushing."
    exit 2
fi

# --- Hard reset ---
if echo "$COMMAND" | grep -qEe 'git\s+reset\s+--hard'; then
    echo "BLOCKED [destructive-git]: git reset --hard detected."
    echo "This permanently discards all uncommitted changes."
    echo "Use 'git stash' to preserve work, or 'git reset --soft HEAD~1' to uncommit safely."
    exit 2
fi

# --- Discard working tree ---
if echo "$COMMAND" | grep -qEe 'git\s+checkout\s+--\s+\.'; then
    echo "BLOCKED [destructive-git]: git checkout -- . detected."
    echo "This discards all unstaged changes. Use 'git stash' instead."
    exit 2
fi

# --- Clean untracked files ---
if echo "$COMMAND" | grep -qEe 'git\s+clean\s+-[a-z]*f'; then
    echo "BLOCKED [destructive-git]: git clean -f detected."
    echo "This permanently deletes untracked files."
    echo "Run 'git status' to review untracked files, then 'git stash -u' to preserve them."
    exit 2
fi

# --- Force delete protected branch ---
if echo "$COMMAND" | grep -qEe 'git\s+branch\s+-D\b'; then
    BRANCH=$(echo "$COMMAND" | grep -oEe 'git\s+branch\s+-D\s+\S+' | awk '{print $NF}' || echo "")
    if echo "$BRANCH" | grep -qEe '^(main|master|develop|dev|production|prod)$'; then
        echo "BLOCKED [destructive-git]: Force deleting protected branch '$BRANCH'."
        exit 2
    fi
    echo "WARNING [destructive-git]: Force-deleting branch '$BRANCH'. Ensure it is fully merged."
    exit 0
fi

# --- Rebase onto shared branches (advisory) ---
if echo "$COMMAND" | grep -qEe 'git\s+rebase\b' && echo "$COMMAND" | grep -qEe '(main|master|develop|production)'; then
    echo "WARNING [destructive-git]: Rebasing onto a shared branch rewrites commit history."
    echo "Ensure no one else is working on this branch before proceeding."
    exit 0
fi

exit 0
