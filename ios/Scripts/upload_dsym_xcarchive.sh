#!/bin/bash

# Usage:
#   ./upload_dsym.sh <path_to_xcarchive> <api_url> <api_key> [custom_headers] [ipa_path]
# Example:
#   ./upload_dsym.sh MyApp.xcarchive https://api.example.com abc123 'X-Custom-1: val1|X-Custom-2: val2' ./MyApp.ipa

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <path_to_xcarchive> <api_url> <api_key> [custom_headers] [ipa_path]"
  echo "Example: $0 MyApp.xcarchive https://api.example.com abc123 'X-Custom-1: val1|X-Custom-2: val2' ./MyApp.ipa"
  exit 1
fi

ARCHIVE_PATH=$1
API_URL=$2
API_KEY=$3
RAW_CUSTOM_HEADERS="$4"
IPA_PATH="$5"
BUILD_TYPE="ipa"
OS_NAME="ios"
SCRIPT_DIR=$(pwd)

# Validate xcarchive
if [ ! -d "$ARCHIVE_PATH" ]; then
  echo "Error: xcarchive not found at $ARCHIVE_PATH"
  exit 1
fi

INFO_PLIST="$ARCHIVE_PATH/Info.plist"
DSYM_FOLDER="$ARCHIVE_PATH/dSYMs"

if [ ! -f "$INFO_PLIST" ]; then
  echo "Error: Info.plist not found in xcarchive"
  exit 1
fi

# Extract values from Info.plist
VERSION_NAME=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleShortVersionString" "$INFO_PLIST")
VERSION_CODE=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleVersion" "$INFO_PLIST")
APP_UNIQUE_ID=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleIdentifier" "$INFO_PLIST")

# Determine build size
if [ -n "$IPA_PATH" ] && [ -f "$IPA_PATH" ]; then
  echo "Using IPA for build size: $IPA_PATH"
  BUILD_SIZE=$(stat -f%z "$IPA_PATH")
else
  echo "Using .app bundle for build size"
  APP_PATH=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:ApplicationPath" "$INFO_PLIST")
  FULL_APP_PATH="$ARCHIVE_PATH/Products/Applications/$(basename "$APP_PATH")"
  if [ -d "$FULL_APP_PATH" ]; then
    BUILD_SIZE=$(du -sk "$FULL_APP_PATH" | awk '{print $1}')
    BUILD_SIZE=$((BUILD_SIZE * 1024)) # convert KB to bytes
  else
    BUILD_SIZE=0
  fi
fi

echo "Extracted Info:"
echo "  Version Name : $VERSION_NAME"
echo "  Version Code : $VERSION_CODE"
echo "  App ID       : $APP_UNIQUE_ID"
echo "  Build Size   : $BUILD_SIZE"
echo "  dSYM Folder  : $DSYM_FOLDER"

# Validate dSYM folder
if [ ! -d "$DSYM_FOLDER" ]; then
  echo "Error: dSYM folder not found in xcarchive"
  exit 1
fi

# Create .tgz archives for all dSYMs
DSYM_TGZ_FILES=()
for DSYM_DIR in "$DSYM_FOLDER"/*.dSYM; do
  if [ -d "$DSYM_DIR" ]; then
    DSYM_TGZ="$SCRIPT_DIR/$(basename "$DSYM_DIR").tgz"
    tar -czf "$DSYM_TGZ" -C "$DSYM_FOLDER" "$(basename "$DSYM_DIR")"
    DSYM_TGZ_FILES+=("$DSYM_TGZ")
    echo "Created dSYM archive at $DSYM_TGZ"
  fi
done

if [ "${#DSYM_TGZ_FILES[@]}" -eq 0 ]; then
  echo "Error: No dSYM files found in the xcarchive"
  exit 1
fi

# Start building curl command
CURL_COMMAND="curl --request PUT \
  --url $API_URL/builds \
  --header 'Authorization: Bearer $API_KEY'"

# Append custom headers if provided
IFS='|' read -r -a CUSTOM_HEADERS <<< "$RAW_CUSTOM_HEADERS"
for HEADER in "${CUSTOM_HEADERS[@]}"; do
  if [ -n "$HEADER" ]; then
    CURL_COMMAND="$CURL_COMMAND --header '$HEADER'"
  fi
done

# Add base form fields
CURL_COMMAND="$CURL_COMMAND \
  --form version_name=$VERSION_NAME \
  --form version_code=$VERSION_CODE \
  --form build_size=$BUILD_SIZE \
  --form build_type=$BUILD_TYPE \
  --form app_unique_id=$APP_UNIQUE_ID \
  --form os_name=$OS_NAME"

# Add dSYM files
INDEX=0
for DSYM_TGZ in "${DSYM_TGZ_FILES[@]}"; do
  CURL_COMMAND="$CURL_COMMAND \
    --form mappings[$INDEX].type=dsym \
    --form mappings[$INDEX].filename=@$DSYM_TGZ"
  INDEX=$((INDEX+1))
done

# Execute the curl command
echo "Executing curl command..."
HTTP_RESPONSE=$(eval "$CURL_COMMAND --write-out '%{http_code}' --silent --output /dev/null")

# Handle response
case "$HTTP_RESPONSE" in
  401)
    echo "[ERROR]: Failed to upload mapping file to Measure, please check API key."
    ;;
  413)
    echo "[ERROR]: Failed to upload mapping file to Measure, mapping file too large."
    ;;
  500)
    echo "[ERROR]: Server error, try again later."
    ;;
  *)
    echo "Upload completed!"
    ;;
esac

# Cleanup
for DSYM_TGZ in "${DSYM_TGZ_FILES[@]}"; do
  rm -f "$DSYM_TGZ"
done