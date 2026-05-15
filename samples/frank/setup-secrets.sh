#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  echo "Copy .env.example to .env and fill in the values."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

# Android: Measure config in local.properties
LOCAL_PROPS="$SCRIPT_DIR/local.properties"
if [ -f "$LOCAL_PROPS" ]; then
  # Remove existing measure.* lines (portable across macOS and Linux)
  grep -v '^measure\.' "$LOCAL_PROPS" > "$LOCAL_PROPS.tmp" && mv "$LOCAL_PROPS.tmp" "$LOCAL_PROPS"
fi
{
  echo "measure.debug.apiKey=${FRANK_MEASURE_ANDROID_API_KEY_DEBUG:-}"
  echo "measure.debug.apiUrl=${FRANK_MEASURE_ANDROID_API_URL_DEBUG:-}"
  echo "measure.release.apiKey=${FRANK_MEASURE_ANDROID_API_KEY_RELEASE:-}"
  echo "measure.release.apiUrl=${FRANK_MEASURE_ANDROID_API_URL_RELEASE:-}"
} >> "$LOCAL_PROPS"
echo "Wrote Measure config to local.properties"

# iOS: MeasureDebug.xcconfig
ESCAPED_DEBUG_URL=$(echo "${FRANK_MEASURE_IOS_API_URL_DEBUG:-}" | sed 's|//|$()/$()/|g')
printf '#include? "Generated.xcconfig"\n\nMEASURE_API_KEY = %s\nMEASURE_API_URL = %s\n' \
  "${FRANK_MEASURE_IOS_API_KEY_DEBUG:-}" "$ESCAPED_DEBUG_URL" \
  > "$SCRIPT_DIR/ios/MeasureDebug.xcconfig"
echo "Wrote ios/MeasureDebug.xcconfig"

# iOS: MeasureRelease.xcconfig
ESCAPED_RELEASE_URL=$(echo "${FRANK_MEASURE_IOS_API_URL_RELEASE:-}" | sed 's|//|$()/$()/|g')
printf '#include? "Generated.xcconfig"\n\nMEASURE_API_KEY = %s\nMEASURE_API_URL = %s\n' \
  "${FRANK_MEASURE_IOS_API_KEY_RELEASE:-}" "$ESCAPED_RELEASE_URL" \
  > "$SCRIPT_DIR/ios/MeasureRelease.xcconfig"
echo "Wrote ios/MeasureRelease.xcconfig"

echo "Done."
