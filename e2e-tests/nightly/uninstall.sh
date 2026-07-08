#!/usr/bin/env bash
set -euo pipefail

LABEL="sh.measure.e2e-nightly"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
rm -f "$PLIST"
echo "Removed $LABEL"
