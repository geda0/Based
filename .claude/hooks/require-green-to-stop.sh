#!/usr/bin/env bash
# Stop / SubagentStop: refuse to stop on a RED bar during green/refactor phases.
#
# The cached .claude/state/suite-status can be briefly stale — the PostToolUse
# run-suite write can race with a stop, leaving "red" while the suite is actually
# green. So when the cache says red we RE-RUN the layer suite to get the
# authoritative truth before blocking. Cached green → trust it (common path, no
# latency). Exit 2 blocks the stop and feeds the reason back so work continues.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE="$ROOT/.claude/state"
CONFIG="$ROOT/.claude/tdd.config"

input="$(cat)"
stop_active="$(printf '%s' "$input" | node -e 'const fs=require("fs");let d="";try{d=fs.readFileSync(0,"utf8")}catch(e){}let v=false;try{const j=JSON.parse(d);v=!!j.stop_hook_active}catch(e){}process.stdout.write(v?"1":"0")' 2>/dev/null || echo 0)"

# Avoid infinite loops: if a stop hook already triggered this continuation, allow.
[ "$stop_active" = "1" ] && exit 0

phase="$(tr -d '[:space:]' < "$STATE/phase" 2>/dev/null || true)"
status="$(tr -d '[:space:]' < "$STATE/suite-status" 2>/dev/null || true)"

# Only green/refactor require a green bar to stop.
case "$phase" in green|refactor) : ;; *) exit 0 ;; esac

# Cached green → trust it, allow immediately (no suite run).
[ "$status" != "red" ] && exit 0

# Cached red → re-verify authoritatively before blocking.
layer="$(tr -d '[:space:]' < "$STATE/layer" 2>/dev/null || true)"
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"
cmd=""
case "$layer" in
  backend)  cmd="${BE_TEST_CMD:-}" ;;
  frontend) cmd="${FE_TEST_CMD:-}" ;;
  e2e)      cmd="${E2E_TEST_CMD:-}" ;;
esac

if [ -n "$cmd" ]; then
  cd "$ROOT" || true
  if out="$(eval "$cmd" 2>&1)"; then
    printf 'green\n' > "$STATE/suite-status"
    echo "require-green-to-stop: cached status was stale; re-ran $layer suite -> GREEN. Allowing stop." >&2
    exit 0
  fi
  printf 'red\n' > "$STATE/suite-status"
  echo "Cannot stop: $layer suite is RED in '$phase' phase. Make it green or revert before ending." >&2
  printf '%s\n' "$out" | tail -n 20 >&2
  exit 2
fi

# No layer/command to re-verify with → fail safe and block on the cached red.
echo "Cannot stop: suite-status=red in '$phase' phase and no layer suite to re-verify. Make it green or revert." >&2
exit 2
