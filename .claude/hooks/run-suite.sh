#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit): run the active layer's suite, record status to
# .claude/state/suite-status. Exit 2 on RED so the failure is fed back to the agent;
# exit 0 on GREEN or when there is nothing to run.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE="$ROOT/.claude/state"
CONFIG="$ROOT/.claude/tdd.config"

phase="$(tr -d '[:space:]' < "$STATE/phase" 2>/dev/null || true)"
layer="$(tr -d '[:space:]' < "$STATE/layer" 2>/dev/null || true)"

# Only run when a layer is active.
[ -z "$layer" ] && exit 0

# Skip when the edited file isn't in a code workspace (config/docs/state edits).
input="$(cat)"
fp="$(printf '%s' "$input" | node -e 'const fs=require("fs");let d="";try{d=fs.readFileSync(0,"utf8")}catch(e){}let p="";try{const j=JSON.parse(d);p=(j.tool_input&&(j.tool_input.file_path||j.tool_input.filePath))||""}catch(e){}process.stdout.write(String(p))' 2>/dev/null || true)"
rel="${fp#"$ROOT"/}"
case "$rel" in
  backend/*|frontend/*|e2e/*) : ;;
  *) exit 0 ;;
esac

# Resolve the layer's test command from tdd.config.
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"
cmd=""
case "$layer" in
  backend)  cmd="${BE_TEST_CMD:-}" ;;
  frontend) cmd="${FE_TEST_CMD:-}" ;;
  e2e)      cmd="${E2E_TEST_CMD:-}" ;;
esac
[ -z "$cmd" ] && exit 0

cd "$ROOT" || exit 0
out="$(eval "$cmd" 2>&1)"; code=$?

if [ "$code" -eq 0 ]; then
  echo "green" > "$STATE/suite-status"
  echo "SUITE GREEN ($layer): $cmd" >&2
  exit 0
fi

echo "red" > "$STATE/suite-status"
if [ "$phase" = "red" ]; then
  echo "SUITE RED ($layer) — expected in red phase; confirm it fails for the RIGHT reason:" >&2
else
  echo "SUITE RED ($layer) in '$phase' phase — must be fixed (or reverted) before stopping:" >&2
fi
printf '%s\n' "$out" | tail -n 30 >&2
exit 2
