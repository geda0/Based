#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit): enforce TDD phase x layer edit scope.
# Reads .claude/state/{phase,layer}. Blocks with exit 2 on a violation; else exit 0.
# Fails OPEN (allows the edit) on any unexpected condition — the referee should
# never wedge legitimate work; it only stops the two hard violations.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE="$ROOT/.claude/state"

phase="$(tr -d '[:space:]' < "$STATE/phase" 2>/dev/null || true)"
layer="$(tr -d '[:space:]' < "$STATE/layer" 2>/dev/null || true)"

# Extract the target file path from the tool input JSON on stdin.
input="$(cat)"
fp="$(printf '%s' "$input" | node -e 'const fs=require("fs");let d="";try{d=fs.readFileSync(0,"utf8")}catch(e){}let p="";try{const j=JSON.parse(d);p=(j.tool_input&&(j.tool_input.file_path||j.tool_input.filePath))||""}catch(e){}process.stdout.write(String(p))' 2>/dev/null || true)"

# Nothing to enforce without an active phase or a target file.
[ -z "$phase" ] && exit 0
[ -z "$fp" ] && exit 0

# Repo-relative path.
rel="${fp#"$ROOT"/}"

# Which code workspace does the file live in (if any)?
file_layer=""
case "$rel" in
  backend/*)  file_layer="backend" ;;
  frontend/*) file_layer="frontend" ;;
  e2e/*)      file_layer="e2e" ;;
esac

# Files outside the code workspaces (.claude/*, docs/*, root config) are always allowed.
[ -z "$file_layer" ] && exit 0

# e2e specs are authored directly across phases; don't gate them on the test/source rule.
[ "$file_layer" = "e2e" ] && exit 0

is_test=0; is_src=0
case "$rel" in
  */tests/*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) is_test=1 ;;
esac
case "$rel" in
  backend/src/*|frontend/src/*) is_src=1 ;;
esac

block() { echo "BLOCKED by guard-edit-scope (phase=$phase, layer=$layer): $1" >&2; exit 2; }

# Stay in the active layer's workspace during red/green.
if [ -n "$layer" ] && { [ "$phase" = "red" ] || [ "$phase" = "green" ]; } && [ "$file_layer" != "$layer" ]; then
  block "active layer is '$layer' but '$rel' is in '$file_layer'. Switch .claude/state/layer first."
fi

case "$phase" in
  red)
    [ "$is_src" = "1" ] && block "red phase edits only the failing test; '$rel' is source. Write the test, not the implementation."
    ;;
  green)
    [ "$is_test" = "1" ] && block "green phase edits only source; '$rel' is a test. Never modify a test to reach green — raise it with the navigator if a test looks wrong."
    ;;
  refactor) : ;;  # anything in-layer is allowed; the suite must stay green
esac

exit 0
