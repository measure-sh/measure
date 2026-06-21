#!/usr/bin/env bash
set -euo pipefail

# Establishes the preconditions the Node runner expects (docker daemon,
# self-host stack, booted devices), runs the suite, tears down.

NIGHTLY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(cd "$NIGHTLY_DIR/.." && pwd)"
REPO_ROOT="$(cd "$E2E_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/self-host/compose.yml"
FRANK_APP_ID_ANDROID="sh.frankenstein.android"
FRANK_APP_ID_IOS="sh.frankenstein.ios.debug"

# launchd gives jobs a minimal PATH, so add the tool locations explicitly.
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.maestro/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
export PATH ANDROID_SDK_ROOT

# Run against the latest main: reset this checkout to origin/main, then re-exec
# the freshly pulled script so the rest of the run uses it. Discards local
# changes here. Set NIGHTLY_NO_PULL=1 to skip (run in place, e.g. local dev).
if [ -z "${NIGHTLY_NO_PULL:-}" ]; then
  git -C "$REPO_ROOT" fetch --quiet origin main
  git -C "$REPO_ROOT" checkout --quiet -f -B main origin/main
  NIGHTLY_NO_PULL=1 exec "$NIGHTLY_DIR/run-nightly.sh" "$@"
fi

[ -f "$NIGHTLY_DIR/config.local.sh" ] && source "$NIGHTLY_DIR/config.local.sh"
source "$NIGHTLY_DIR/config.sh"

mkdir -p "$NIGHTLY_DIR/logs"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$NIGHTLY_DIR/logs/nightly-$STAMP.log"
exec > >(tee -a "$LOG") 2>&1

say() { echo "[nightly $(date +%H:%M:%S)] $*"; }
die() { say "FATAL: $*"; exit 1; }

notify() {
  [ -n "$NOTIFY_WEBHOOK" ] || return 0
  curl -fsS -X POST -H 'Content-Type: application/json' \
    -d "{\"text\": \"$1\"}" "$NOTIFY_WEBHOOK" >/dev/null \
    || say "warning: notify webhook failed"
}

teardown() {
  say "tearing down stack and devices"
  docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
  adb devices | awk 'NR>1 && $2=="device" {print $1}' | grep '^emulator-' \
    | while read -r d; do adb -s "$d" emu kill >/dev/null 2>&1 || true; done
  xcrun simctl shutdown all >/dev/null 2>&1 || true
}

finish() {
  local rc=$1
  teardown
  find "$NIGHTLY_DIR/logs" -name 'nightly-*.log' -mtime "+$KEEP_LOGS_DAYS" -delete 2>/dev/null || true
  if [ "$rc" -eq 0 ]; then
    say "SUCCESS"
    notify "e2e nightly PASSED ($(basename "$LOG"))"
  else
    say "FAILED (exit $rc)"
    notify "e2e nightly FAILED ($(basename "$LOG")), see host logs"
  fi
}

ensure_docker() {
  if docker info >/dev/null 2>&1; then return; fi
  say "docker daemon not running, starting it (DOCKER_MODE=$DOCKER_MODE)"
  case "$DOCKER_MODE" in
    colima) colima start ;;
    desktop) open -a Docker ;;
    none) die "docker daemon is down and DOCKER_MODE=none" ;;
    auto) if command -v colima >/dev/null 2>&1; then colima start; else open -a Docker; fi ;;
    *) die "unknown DOCKER_MODE: $DOCKER_MODE" ;;
  esac
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && return
    sleep 2
  done
  die "docker daemon did not become ready"
}

ensure_stack() {
  [ -f "$COMPOSE_FILE" ] || die "self-host compose file not found at $COMPOSE_FILE"
  say "recreating self-host stack"
  docker compose -f "$COMPOSE_FILE" down
  docker compose -f "$COMPOSE_FILE" up -d --wait
}

ensure_android() {
  if [ -n "$(adb devices | awk 'NR>1 && $2=="device"')" ]; then
    say "android device already attached"
  else
    [ -n "$ANDROID_AVD" ] || die "no android device attached and ANDROID_AVD is unset"
    say "booting emulator: $ANDROID_AVD"
    # shellcheck disable=SC2086
    emulator -avd "$ANDROID_AVD" $ANDROID_EMULATOR_FLAGS >>"$LOG" 2>&1 &
    adb wait-for-device
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
    say "emulator booted"
  fi
  # Remove a prior Frank so a stale higher versionCode can't block install and
  # no SDK state carries between nights; the runner builds and installs fresh.
  adb uninstall "$FRANK_APP_ID_ANDROID" >/dev/null 2>&1 || true
  # Gboard's stylus-handwriting sheet swallows the bug_report text input.
  adb shell settings put secure stylus_handwriting_enabled 0 || true
  adb shell settings put secure stylus_handwriting_default_value 0 || true
}

ensure_ios() {
  if xcrun simctl list devices booted | grep -q Booted; then
    say "ios simulator already booted"
  else
    [ -n "$IOS_SIMULATOR" ] || die "no simulator booted and IOS_SIMULATOR is unset"
    say "booting simulator: $IOS_SIMULATOR"
    xcrun simctl boot "$IOS_SIMULATOR"
    xcrun simctl bootstatus "$IOS_SIMULATOR" -b
  fi
  xcrun simctl uninstall booted "$FRANK_APP_ID_IOS" >/dev/null 2>&1 || true
  open -a Simulator
}

ensure_deps() {
  if [ ! -d "$E2E_DIR/node_modules" ]; then
    say "installing node dependencies"
    ( cd "$E2E_DIR" && npm ci )
    ( cd "$E2E_DIR" && npx playwright install chromium )
  fi
}

platforms() {
  case "$DEVICES" in
    android) echo "android" ;;
    ios) echo "ios" ;;
    both) echo "android ios" ;;
    *) die "unknown DEVICES: $DEVICES" ;;
  esac
}

run_platform() {
  local device="$1"
  if [ "$device" = android ]; then ensure_android; else ensure_ios; fi

  local args=()
  [ -n "$SPECS" ] && for s in $SPECS; do args+=("$s"); done
  args+=("--$device")
  [ "$SEED_GALLERY" = true ] && args+=(--seed-gallery)
  args+=(--verbose)

  say "running $device: npm start -- ${args[*]}"
  ( cd "$E2E_DIR" && npm start -- "${args[@]}" )
}

# Run each platform as its own full pass; if one fails, still run the next.
run_suite() {
  local overall=0
  for device in $(platforms); do
    run_platform "$device" || overall=1
  done
  return "$overall"
}

main() {
  say "nightly run starting (repo: $REPO_ROOT)"
  ensure_docker
  ensure_stack
  ensure_deps
  run_suite
}

rc=0
main || rc=$?
finish "$rc"
exit "$rc"
