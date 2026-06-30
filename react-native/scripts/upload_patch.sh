#!/bin/bash

# Uploads an OTA patch sourcemap to Measure so that crash stack traces
# from that patch can be symbolicated.
#
# Run this after publishing an OTA update, once per platform.
#
# Usage:
#   upload_patch.sh <api_key> <api_url> <patch_id> <path_to_sourcemap>
#
# Arguments:
#   api_key            Measure API key
#   api_url            Measure API URL (e.g. https://measure.example.com)
#   patch_id           OTA patch UUID — must be a valid UUID (e.g. EAS update group ID)
#   path_to_sourcemap  Path to the .hbc.map from 'expo export --source-maps'
#                      Must contain /ios/ or /android/ in the path to detect platform.
#
# Platform detection:
#   Files are stored under canonical React Native bundle names:
#     iOS:     main.jsbundle  /  main.jsbundle.map
#     Android: index.android.bundle  /  index.android.bundle.map
#   The RN SDK normalises all OTA bundle filenames in stack frames to these
#   same canonical names, so the symboloader abs_path lookup succeeds.
#
# Note: if you upload both iOS and Android with the same patch_id, only the
# last-uploaded platform will be symbolicated. Use separate patch_id UUIDs
# per platform if you need both to work simultaneously.
#
# Example:
#   ./upload_patch.sh "msr_key_..." "https://measure.example.com" \
#     "32d4e57e-6259-40ee-9b02-40aafeefcafd" \
#     "./dist/_expo/static/js/ios/entry-abc123.hbc.map"

set -euo pipefail

if [ "$#" -lt 4 ]; then
  echo "Usage: $0 <api_key> <api_url> <patch_id> <path_to_sourcemap>"
  exit 1
fi

API_KEY="$1"
API_URL="${2%/}"
PATCH_ID="$3"
SOURCEMAP_PATH="$4"

MAX_ATTEMPTS=3

# --- Validate ---

echo "patch_id:  $PATCH_ID"
echo "api_url:   $API_URL"
echo "sourcemap: $SOURCEMAP_PATH"
echo ""

if [ ! -f "$SOURCEMAP_PATH" ]; then
  echo "Error: sourcemap file not found: $SOURCEMAP_PATH"
  exit 1
fi

# --- Detect platform from sourcemap path ---

if echo "$SOURCEMAP_PATH" | grep -q '/ios/'; then
  PLATFORM=ios
elif echo "$SOURCEMAP_PATH" | grep -q '/android/'; then
  PLATFORM=android
else
  echo "Error: cannot detect platform from sourcemap path."
  echo "Path must contain /ios/ or /android/ (e.g. dist/_expo/static/js/ios/entry-abc.hbc.map)"
  exit 1
fi

# --- Set canonical filenames ---
#
# The RN SDK normalises all OTA bundle filenames in stack frames to these
# canonical names (via Platform.OS in exceptionBuilder.ts), so the files
# stored in GCS must use the same names for the symboloader abs_path lookup
# to succeed.

if [ "$PLATFORM" = ios ]; then
  BUNDLE_CANONICAL="main.jsbundle"
  MAP_CANONICAL="main.jsbundle.map"
else
  BUNDLE_CANONICAL="index.android.bundle"
  MAP_CANONICAL="index.android.bundle.map"
fi

BUNDLE_TGZ_BASENAME="${BUNDLE_CANONICAL}.tgz"
MAP_TGZ_BASENAME="${MAP_CANONICAL}.tgz"

echo "Platform:  $PLATFORM"
echo "Bundle:    $BUNDLE_CANONICAL (zero-byte placeholder)"
echo "Map:       $MAP_CANONICAL"
echo ""

# --- Temp dir and cleanup ---

TEMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT
echo "Working directory: $TEMP_DIR"

# --- Create zero-byte bundle and copy sourcemap into temp dir ---

touch "$TEMP_DIR/$BUNDLE_CANONICAL"
cp "$SOURCEMAP_PATH" "$TEMP_DIR/$MAP_CANONICAL"

# --- Package as .tgz (file at archive root, no path prefix) ---

echo "Packaging $BUNDLE_TGZ_BASENAME..."
tar -czf "$TEMP_DIR/$BUNDLE_TGZ_BASENAME" -C "$TEMP_DIR" "$BUNDLE_CANONICAL"

echo "Packaging $MAP_TGZ_BASENAME..."
tar -czf "$TEMP_DIR/$MAP_TGZ_BASENAME" -C "$TEMP_DIR" "$MAP_CANONICAL"
MAP_TGZ_SIZE=$(du -sh "$TEMP_DIR/$MAP_TGZ_BASENAME" | awk '{print $1}')
echo "Map archive size: $MAP_TGZ_SIZE"
echo ""

# --- Register with PUT /builds/ota ---

METADATA_FILE="$TEMP_DIR/metadata.json"
cat <<END_JSON > "$METADATA_FILE"
{
  "patch_id": "$PATCH_ID",
  "mappings": [
    { "type": "jsbundle", "filename": "$BUNDLE_TGZ_BASENAME" },
    { "type": "jsbundle", "filename": "$MAP_TGZ_BASENAME" }
  ]
}
END_JSON

echo "Registering OTA patch with Measure..."
RESPONSE_FILE="$TEMP_DIR/response.json"

HTTP_STATUS=$(curl --silent --request PUT \
  --url "$API_URL/builds/ota" \
  --header "Authorization: Bearer $API_KEY" \
  --header "Content-Type: application/json" \
  --data "@$METADATA_FILE" \
  --write-out "%{http_code}" \
  --output "$RESPONSE_FILE")

RESPONSE=$(cat "$RESPONSE_FILE")
echo "Registration HTTP status: $HTTP_STATUS"

case "$HTTP_STATUS" in
  200|201) echo "Registration successful." ;;
  401)
    echo "Error: Unauthorized — check your API key."
    exit 1
    ;;
  500)
    echo "Error: Server error. Try again later."
    exit 1
    ;;
  *)
    echo "Error: Registration failed with HTTP $HTTP_STATUS."
    echo "Response: $RESPONSE"
    exit 1
    ;;
esac

echo ""

# --- Extract upload URLs and mapping IDs ---
# Response ordering is guaranteed to match submission order:
# index 0 = bundle tgz, index 1 = map tgz.

echo "Parsing presigned upload URLs..."

BUNDLE_UPLOAD_URL=$(echo "$RESPONSE" | grep -o '"upload_url":"[^"]*"' | sed 's/"upload_url":"//;s/"$//;s/\\u0026/\&/g' | sed -n '1p' || true)
MAP_UPLOAD_URL=$(echo "$RESPONSE"    | grep -o '"upload_url":"[^"]*"' | sed 's/"upload_url":"//;s/"$//;s/\\u0026/\&/g' | sed -n '2p' || true)

# The mapping_id header key is prefixed with either x-amz-meta- (S3) or
# x-goog-meta- (GCS) depending on the storage backend.
BUNDLE_MAPPING_ID=$(echo "$RESPONSE" | grep -o '"[^"]*meta-mapping_id":"[^"]*"' | sed 's/^"[^"]*":"//' | sed 's/"$//' | sed -n '1p' || true)
MAP_MAPPING_ID=$(echo "$RESPONSE"    | grep -o '"[^"]*meta-mapping_id":"[^"]*"' | sed 's/^"[^"]*":"//' | sed 's/"$//' | sed -n '2p' || true)

if [ -z "$BUNDLE_UPLOAD_URL" ] || [ -z "$MAP_UPLOAD_URL" ]; then
  echo "Error: Failed to extract upload URLs from server response."
  echo "Response: $RESPONSE"
  exit 1
fi

if [ -z "$BUNDLE_MAPPING_ID" ] || [ -z "$MAP_MAPPING_ID" ]; then
  echo "Error: Failed to extract mapping IDs from server response."
  echo "Response: $RESPONSE"
  exit 1
fi

# Detect storage provider from the presigned URL
if echo "$BUNDLE_UPLOAD_URL" | grep -q "googleapis.com"; then
  HEADER_PREFIX="x-goog-meta"
  echo "Storage backend: GCS"
else
  HEADER_PREFIX="x-amz-meta"
  echo "Storage backend: S3"
fi

echo "Bundle mapping_id: $BUNDLE_MAPPING_ID"
echo "Map mapping_id:    $MAP_MAPPING_ID"
echo ""

# --- Upload files ---

upload_file() {
  local FILE_PATH="$1"
  local UPLOAD_URL="$2"
  local MAPPING_ID="$3"
  local FILENAME="$4"

  local ATTEMPT
  local RESPONSE_BODY_FILE
  RESPONSE_BODY_FILE=$(mktemp)

  for ATTEMPT in $(seq 1 $MAX_ATTEMPTS); do
    echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS: Uploading $FILENAME..."
    FILE_STATUS=$(curl --silent --request PUT \
      --url "$UPLOAD_URL" \
      --header "${HEADER_PREFIX}-mapping_id: $MAPPING_ID" \
      --header "${HEADER_PREFIX}-original_file_name: $FILENAME" \
      --data-binary "@$FILE_PATH" \
      --write-out "%{http_code}" \
      --output "$RESPONSE_BODY_FILE")

    if [ "$FILE_STATUS" -ge 200 ] && [ "$FILE_STATUS" -le 299 ]; then
      echo "  [SUCCESS]: $FILENAME uploaded. HTTP $FILE_STATUS"
      rm -f "$RESPONSE_BODY_FILE"
      return 0
    else
      echo "  [WARN]: Upload returned HTTP $FILE_STATUS."
      echo "  Response: $(cat "$RESPONSE_BODY_FILE")"
      if [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; then
        echo "  Retrying in 1s..."
        sleep 1
      fi
    fi
  done

  rm -f "$RESPONSE_BODY_FILE"
  echo "  [ERROR]: Failed to upload $FILENAME after $MAX_ATTEMPTS attempts."
  return 1
}

echo "Uploading files..."

FAILED=0

upload_file \
  "$TEMP_DIR/$BUNDLE_TGZ_BASENAME" \
  "$BUNDLE_UPLOAD_URL" \
  "$BUNDLE_MAPPING_ID" \
  "$BUNDLE_TGZ_BASENAME" || FAILED=1

upload_file \
  "$TEMP_DIR/$MAP_TGZ_BASENAME" \
  "$MAP_UPLOAD_URL" \
  "$MAP_MAPPING_ID" \
  "$MAP_TGZ_BASENAME" || FAILED=1

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "Done. OTA patch registered. patch_id: $PATCH_ID"
else
  echo "Error: One or more files failed to upload."
  exit 1
fi
