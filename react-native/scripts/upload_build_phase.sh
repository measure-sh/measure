#!/bin/bash

# Uploads dSYM files and React Native JavaScript sourcemaps to Measure.
# Designed to be added as an Xcode Run Script Build Phase.
#
# Version name, version code, bundle ID, dSYM path, and build size are all
# read automatically from Xcode environment variables.
#
# Usage (in Xcode Build Phase):
#   "${SRCROOT}/../node_modules/@measuresh/react-native/scripts/upload_build_phase.sh" \
#     <api_url> \
#     <api_key>
#
# To also upload JS sourcemaps, set SOURCEMAP_FILE in the "Bundle React Native
# code and images" build phase:
#   export SOURCEMAP_FILE="$(pwd)/main.jsbundle.map"
#
# See https://github.com/measure-sh/measure/blob/main/docs/features/feature-crash-reporting.md

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <api_url> <api_key>"
  exit 1
fi

API_URL="${1%/}"
API_KEY="$2"
BUILD_TYPE="ipa"
OS_NAME="ios"
SCRIPT_DIR=$(pwd)
TEMP_FILES=()

# Hermes bytecode magic bytes
HERMES_MAGIC="c61fbc03c103191f"

# --- Validate Xcode environment ---

if [ -z "$DWARF_DSYM_FOLDER_PATH" ] || [ -z "$DWARF_DSYM_FILE_NAME" ]; then
  echo "Error: DWARF_DSYM_FOLDER_PATH or DWARF_DSYM_FILE_NAME not set. Run this script from an Xcode build phase."
  exit 1
fi

if [ -z "$MARKETING_VERSION" ] || [ -z "$CURRENT_PROJECT_VERSION" ] || [ -z "$PRODUCT_BUNDLE_IDENTIFIER" ]; then
  echo "Error: MARKETING_VERSION, CURRENT_PROJECT_VERSION, or PRODUCT_BUNDLE_IDENTIFIER not set."
  exit 1
fi

VERSION_NAME="$MARKETING_VERSION"
VERSION_CODE="$CURRENT_PROJECT_VERSION"
APP_UNIQUE_ID="$PRODUCT_BUNDLE_IDENTIFIER"

DSYM_FOLDER="$DWARF_DSYM_FOLDER_PATH"
# The compiled bundle lives inside the .app bundle, not directly in BUILT_PRODUCTS_DIR
BUNDLE_FILE="${BUILT_PRODUCTS_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/main.jsbundle"

# --- Build size: use .app bundle as approximation ---

APP_PATH="${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app"
BUILD_SIZE=1
if [ -d "$APP_PATH" ]; then
  APP_SIZE_KB=$(du -sk "$APP_PATH" 2>/dev/null | awk '{print $1}')
  if [ -n "$APP_SIZE_KB" ] && [ "$APP_SIZE_KB" -gt 0 ]; then
    BUILD_SIZE=$((APP_SIZE_KB * 1024))
  fi
fi

# --- Dependency check ---

check_dependencies() {
  if ! command -v jq &>/dev/null; then
    echo "Error: jq is required. Install with 'brew install jq'."
    exit 1
  fi
  if ! command -v xxd &>/dev/null; then
    echo "Error: xxd is required."
    exit 1
  fi
}

cleanup() {
  for temp_file in "${TEMP_FILES[@]}"; do
    [ -f "$temp_file" ] && rm -f "$temp_file"
  done
}
trap cleanup EXIT

check_dependencies

# --- Package dSYMs ---

ALL_TGZ_FILES=()
ALL_TGZ_BASENAMES=()
JSON_MAPPINGS="["
INDEX=0

if [ ! -d "$DSYM_FOLDER" ]; then
  echo "Error: dSYM folder not found at $DSYM_FOLDER"
  exit 1
fi

for DSYM_DIR in "$DSYM_FOLDER"/*.dSYM; do
  if [ -d "$DSYM_DIR" ]; then
    TGZ_BASENAME="$(basename "$DSYM_DIR").tgz"
    DSYM_TGZ="$SCRIPT_DIR/$TGZ_BASENAME"
    tar -czf "$DSYM_TGZ" -C "$DSYM_FOLDER" "$(basename "$DSYM_DIR")"

    ALL_TGZ_FILES+=("$DSYM_TGZ")
    ALL_TGZ_BASENAMES+=("$TGZ_BASENAME")
    TEMP_FILES+=("$DSYM_TGZ")

    if [ "$INDEX" -gt 0 ]; then
      JSON_MAPPINGS="$JSON_MAPPINGS,"
    fi
    JSON_MAPPINGS="$JSON_MAPPINGS {\"type\": \"dsym\", \"filename\": \"$TGZ_BASENAME\"}"
    INDEX=$((INDEX+1))
  fi
done

if [ "${#ALL_TGZ_FILES[@]}" -eq 0 ]; then
  echo "Error: No dSYM files found in $DSYM_FOLDER"
  exit 1
fi

# --- Handle JS sourcemap and bundle (React Native only) ---

# SOURCEMAP_FILE is set in the "Bundle React Native code and images" phase via
# `export SOURCEMAP_FILE="$(pwd)/main.jsbundle.map"`. Because each Xcode Run
# Script phase runs in its own shell, that export is not visible here. We fall
# back to the default location ($SRCROOT/main.jsbundle.map) which is where the
# file lands when users follow the documentation.
RESOLVED_SOURCEMAP="${SOURCEMAP_FILE}"
if [ -z "$RESOLVED_SOURCEMAP" ] || [ ! -f "$RESOLVED_SOURCEMAP" ]; then
  RESOLVED_SOURCEMAP="${SRCROOT}/main.jsbundle.map"
fi

if [ -f "$RESOLVED_SOURCEMAP" ]; then
  echo "Sourcemap found at $RESOLVED_SOURCEMAP"

  # Copy sourcemap to temp — do not modify the original
  TEMP_MAP=$(mktemp)
  TEMP_FILES+=("$TEMP_MAP")
  cp "$RESOLVED_SOURCEMAP" "$TEMP_MAP"

  # Strip absolute path prefixes using node_modules as the anchor
  PREFIX=$(jq -r '
    ((.sources // [])[] | select(contains("node_modules/"))) |
    split("node_modules/")[0]
  ' "$TEMP_MAP" 2>/dev/null | head -1)

  if [ -n "$PREFIX" ]; then
    echo "Stripping path prefix: $PREFIX"
    STRIPPED=$(mktemp)
    TEMP_FILES+=("$STRIPPED")
    jq --arg prefix "$PREFIX" '
      .sources |= map(
        if startswith($prefix) then
          .[$prefix | length:] | if . == "" then "unknown" else . end
        else
          (split("/") | map(select(. != "")) | last) // .
        end
      )
    ' "$TEMP_MAP" > "$STRIPPED" && mv "$STRIPPED" "$TEMP_MAP"
  else
    echo "Warning: Could not detect path prefix from node_modules. Uploading sourcemap as-is."
  fi

  # Package sourcemap tarball
  MAP_BASENAME="main.jsbundle.map"
  MAP_TGZ_BASENAME="${MAP_BASENAME}.tgz"
  MAP_TGZ="$SCRIPT_DIR/$MAP_TGZ_BASENAME"
  TEMP_MAP_DIR=$(mktemp -d)
  TEMP_FILES+=("$MAP_TGZ")
  cp "$TEMP_MAP" "$TEMP_MAP_DIR/$MAP_BASENAME"
  tar -czf "$MAP_TGZ" -C "$TEMP_MAP_DIR" "$MAP_BASENAME"
  rm -rf "$TEMP_MAP_DIR"

  ALL_TGZ_FILES+=("$MAP_TGZ")
  ALL_TGZ_BASENAMES+=("$MAP_TGZ_BASENAME")
  JSON_MAPPINGS="$JSON_MAPPINGS, {\"type\": \"jsbundle\", \"filename\": \"$MAP_TGZ_BASENAME\"}"

  # Detect Hermes vs JSC via HBC magic bytes
  IS_HERMES=false
  if [ -f "$BUNDLE_FILE" ]; then
    BUNDLE_HEX=$(xxd -p -l 8 "$BUNDLE_FILE" 2>/dev/null | tr -d '\n')
    if [ "$BUNDLE_HEX" = "$HERMES_MAGIC" ]; then
      IS_HERMES=true
    fi
  fi

  # Package bundle tarball
  BUNDLE_BASENAME="main.jsbundle"
  BUNDLE_TGZ_BASENAME="${BUNDLE_BASENAME}.tgz"
  BUNDLE_TGZ="$SCRIPT_DIR/$BUNDLE_TGZ_BASENAME"
  TEMP_BUNDLE_DIR=$(mktemp -d)
  TEMP_FILES+=("$BUNDLE_TGZ")

  if [ "$IS_HERMES" = true ]; then
    echo "Hermes detected — using empty bundle placeholder."
    touch "$TEMP_BUNDLE_DIR/$BUNDLE_BASENAME"
  else
    echo "JSC detected — uploading actual JS bundle."
    if [ -f "$BUNDLE_FILE" ]; then
      cp "$BUNDLE_FILE" "$TEMP_BUNDLE_DIR/$BUNDLE_BASENAME"
    else
      echo "Warning: JS bundle not found at $BUNDLE_FILE. Using empty placeholder."
      touch "$TEMP_BUNDLE_DIR/$BUNDLE_BASENAME"
    fi
  fi

  tar -czf "$BUNDLE_TGZ" -C "$TEMP_BUNDLE_DIR" "$BUNDLE_BASENAME"
  rm -rf "$TEMP_BUNDLE_DIR"

  ALL_TGZ_FILES+=("$BUNDLE_TGZ")
  ALL_TGZ_BASENAMES+=("$BUNDLE_TGZ_BASENAME")
  JSON_MAPPINGS="$JSON_MAPPINGS, {\"type\": \"jsbundle\", \"filename\": \"$BUNDLE_TGZ_BASENAME\"}"

else
  echo "No sourcemap found at $RESOLVED_SOURCEMAP — uploading dSYMs only."
fi

JSON_MAPPINGS="$JSON_MAPPINGS ]"

# --- Upload build metadata ---

METADATA_FILE=$(mktemp)
TEMP_FILES+=("$METADATA_FILE")

cat <<END_JSON > "$METADATA_FILE"
{
  "version_name": "$VERSION_NAME",
  "version_code": "$VERSION_CODE",
  "build_size": $BUILD_SIZE,
  "build_type": "$BUILD_TYPE",
  "app_unique_id": "$APP_UNIQUE_ID",
  "os_name": "$OS_NAME",
  "mappings": $JSON_MAPPINGS
}
END_JSON

echo ""
echo "Uploading build metadata..."
RESPONSE_BODY_FILE=$(mktemp)
TEMP_FILES+=("$RESPONSE_BODY_FILE")

HTTP_STATUS=$(curl --silent --request PUT \
  --url "$API_URL/builds" \
  --header "Authorization: Bearer $API_KEY" \
  --header "Content-Type: application/json" \
  --data "@$METADATA_FILE" \
  --write-out "%{http_code}" \
  --output "$RESPONSE_BODY_FILE")

HTTP_RESPONSE=$(cat "$RESPONSE_BODY_FILE")

case "$HTTP_STATUS" in
  200|201) ;;
  401)
    echo "Error: Unauthorized — check your API key."
    exit 1
    ;;
  413)
    echo "Error: Build size exceeds maximum allowed limit."
    exit 1
    ;;
  500)
    echo "Error: Server error. Try again later."
    exit 1
    ;;
  *)
    echo "Error: Metadata upload failed with status $HTTP_STATUS."
    exit 1
    ;;
esac

# --- Upload files to pre-signed URLs ---

UPLOAD_SUCCESS_FLAG=$(mktemp)
TEMP_FILES+=("$UPLOAD_SUCCESS_FLAG")
echo "success" > "$UPLOAD_SUCCESS_FLAG"

echo ""
echo "Uploading files..."
MAX_ATTEMPTS=3

echo "$HTTP_RESPONSE" | jq -c '.mappings[]' | \
while IFS= read -r URL_OBJECT; do
  SIGNED_URL=$(echo "$URL_OBJECT" | jq -r '.upload_url')
  EXPECTED_FILENAME=$(echo "$URL_OBJECT" | jq -r '.filename')

  UPLOAD_HEADERS_CURL=""
  HEADER_LINES=$(echo "$URL_OBJECT" | jq -r '.headers | to_entries[] | "\(.key): \(.value)"')
  while IFS= read -r HEADER_LINE; do
    [ -n "$HEADER_LINE" ] && UPLOAD_HEADERS_CURL+=" --header \"$HEADER_LINE\""
  done <<< "$HEADER_LINES"

  if [ -z "$SIGNED_URL" ] || [ -z "$EXPECTED_FILENAME" ]; then
    echo "[ERROR]: Failed to read upload URL from server response."
    echo "failure" > "$UPLOAD_SUCCESS_FLAG"
    break
  fi

  TGZ_PATH=""
  for ((j=0; j<${#ALL_TGZ_BASENAMES[@]}; j++)); do
    if [ "${ALL_TGZ_BASENAMES[$j]}" = "$EXPECTED_FILENAME" ]; then
      TGZ_PATH="${ALL_TGZ_FILES[$j]}"
      break
    fi
  done

  if [ -z "$TGZ_PATH" ]; then
    echo "[ERROR]: No local file found for $EXPECTED_FILENAME."
    echo "failure" > "$UPLOAD_SUCCESS_FLAG"
    continue
  fi

  UPLOAD_ATTEMPT_SUCCESS=false
  FILE_UPLOAD_COMMAND="curl --request PUT \
    --url \"$SIGNED_URL\" \
    $UPLOAD_HEADERS_CURL \
    --write-out '%{http_code}' \
    --silent \
    --output /dev/null \
    --data-binary \"@$TGZ_PATH\""

  for ATTEMPT in $(seq 1 $MAX_ATTEMPTS); do
    echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS: Uploading $EXPECTED_FILENAME..."
    FILE_STATUS=$(eval "$FILE_UPLOAD_COMMAND")
    if [[ "$FILE_STATUS" -ge 200 && "$FILE_STATUS" -le 299 ]]; then
      echo "  [SUCCESS]: $EXPECTED_FILENAME uploaded. Status: $FILE_STATUS"
      UPLOAD_ATTEMPT_SUCCESS=true
      break
    else
      [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ] && sleep 1
    fi
  done

  if [ "$UPLOAD_ATTEMPT_SUCCESS" = false ]; then
    echo "[ERROR]: Failed to upload $EXPECTED_FILENAME after $MAX_ATTEMPTS attempts."
    echo "failure" > "$UPLOAD_SUCCESS_FLAG"
  fi
done

FINAL_STATUS=$(cat "$UPLOAD_SUCCESS_FLAG")
if [ "$FINAL_STATUS" = "success" ]; then
  echo ""
  echo "✅ Successfully uploaded to Measure."
else
  echo ""
  echo "❌ One or more files failed to upload."
  exit 1
fi
