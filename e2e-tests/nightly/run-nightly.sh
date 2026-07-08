#!/usr/bin/env bash
set -euo pipefail

# This is the launchd entry point. It resets the checkout, loads the config,
# then runs the suite via `npm start`.

NIGHTLY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(cd "$NIGHTLY_DIR/.." && pwd)"
REPO_ROOT="$(cd "$E2E_DIR/.." && pwd)"

# launchd gives jobs a minimal PATH, so add the tool locations explicitly.
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.maestro/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
export PATH ANDROID_SDK_ROOT

# Run against the latest main: reset this checkout to origin/main, then re-exec
# the freshly pulled script. NIGHTLY_NO_PULL=1 skips the reset.
if [ -z "${NIGHTLY_NO_PULL:-}" ]; then
  if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
    echo "refusing to reset: '$REPO_ROOT' has uncommitted changes that" >&2
    echo "'git checkout -f origin/main' would discard. Use a dedicated nightly" >&2
    echo "checkout, or set NIGHTLY_NO_PULL=1 to skip the reset." >&2
    exit 1
  fi
  git -C "$REPO_ROOT" fetch --quiet origin main
  git -C "$REPO_ROOT" checkout --quiet -f -B main origin/main
  NIGHTLY_NO_PULL=1 exec "$NIGHTLY_DIR/run-nightly.sh" "$@"
fi

# Load config (config.local.sh overrides) and export it for the run.
set -a
[ -f "$NIGHTLY_DIR/config.local.sh" ] && source "$NIGHTLY_DIR/config.local.sh"
source "$NIGHTLY_DIR/config.sh"
set +a

# Send all output, including the suite's, to a timestamped log and the console.
mkdir -p "$NIGHTLY_DIR/logs"
LOG_FILE="$NIGHTLY_DIR/logs/nightly-$(date +%Y%m%d-%H%M%S).log"
export LOG_FILE LOG_TIMESTAMPS=1
exec > >(tee -a "$LOG_FILE") 2>&1

# The nightly runs every spec on both devices. npm start recreates the stack,
# boots each device (names from e2e-tests/.env), builds, and tears it all down.
# NOTIFY_WEBHOOK, is where --notify posts the summary.
( cd "$E2E_DIR" && npm start -- --seed-gallery --notify --verbose )
rc=$?

find "$NIGHTLY_DIR/logs" -name 'nightly-*.log' -mtime "+$KEEP_LOGS_DAYS" -delete 2>/dev/null || true
exit "$rc"
