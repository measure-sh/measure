#!/usr/bin/env bash
set -euo pipefail

NIGHTLY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="sh.measure.e2e-nightly"
TEMPLATE="$NIGHTLY_DIR/sh.measure.e2e-nightly.plist.template"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$NIGHTLY_DIR/logs"

[ -f "$NIGHTLY_DIR/config.local.sh" ] && source "$NIGHTLY_DIR/config.local.sh"
source "$NIGHTLY_DIR/config.sh"

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

sed \
  -e "s|__RUN_SCRIPT__|$NIGHTLY_DIR/run-nightly.sh|g" \
  -e "s|__NIGHTLY_DIR__|$NIGHTLY_DIR|g" \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  -e "s|__HOUR__|$SCHEDULE_HOUR|g" \
  -e "s|__MINUTE__|$SCHEDULE_MINUTE|g" \
  "$TEMPLATE" > "$PLIST"

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"

echo "Installed $LABEL"
echo "  schedule: ${SCHEDULE_HOUR}:$(printf '%02d' "$SCHEDULE_MINUTE") daily"
echo "  plist:    $PLIST"
echo "  logs:     $LOG_DIR"
echo
echo "Run it now to verify, without waiting for the schedule:"
echo "  launchctl kickstart -p gui/$UID/$LABEL"
echo
echo "The Mac must be awake and logged in at run time. To wake from sleep"
echo "(only works on AC power, not from a full shutdown):"
echo "  sudo pmset repeat wake MTWRFSU $(printf '%02d:%02d:00' "$SCHEDULE_HOUR" "$SCHEDULE_MINUTE")"
