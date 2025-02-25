#!/bin/bash

# Check if required parameters are provided
if [ "$#" -ne 4 ]; then
  echo "Usage: $0 <path_to_ipa> <path_to_dsym_folder> <api_url> <api_key>"
  exit 1
fi

IPA_PATH=$1
DSYM_FOLDER=$2
API_URL=$3
API_KEY=$4

SCRIPT_DIR=$(pwd) # Get the directory where the script is running

# Validate the IPA file
if [ ! -f "$IPA_PATH" ]; then
  echo "Error: IPA file not found at $IPA_PATH"
  exit 1
fi

# Validate the dSYM folder
if [ ! -d "$DSYM_FOLDER" ]; then
  echo "Error: dSYM folder not found at $DSYM_FOLDER"
  exit 1
fi

# Unzip IPA file
TMP_DIR=$(mktemp -d)
unzip -q "$IPA_PATH" -d "$TMP_DIR"

echo "Contents of unzipped IPA:"
ls "$TMP_DIR"

# Locate the main app's Info.plist
INFO_PLIST=$(find "$TMP_DIR" -path "*/Payload/*.app/Info.plist" -type f | head -n 1)

if [ -z "$INFO_PLIST" ]; then
  echo "Error: Info.plist not found in the IPA"
  rm -rf "$TMP_DIR"
  exit 1
fi

echo "Correct Info.plist found at: $INFO_PLIST"

# Extract version information
VERSION_NAME=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$INFO_PLIST" 2>/dev/null)
VERSION_CODE=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null)
APP_UNIQUE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$INFO_PLIST" 2>/dev/null)

# Handle missing version information gracefully
[ -z "$VERSION_NAME" ] && VERSION_NAME="Unknown"
[ -z "$VERSION_CODE" ] && VERSION_CODE="Unknown"
[ -z "$APP_UNIQUE_ID" ] && APP_UNIQUE_ID="Unknown"

echo "Extracted VERSION_NAME=$VERSION_NAME"
echo "Extracted VERSION_CODE=$VERSION_CODE"
echo "Extracted APP_UNIQUE_ID=$APP_UNIQUE_ID"

# Create .tgz archives for all dSYMs in the script's directory
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
  echo "Error: No dSYM files found in the folder"
  rm -rf "$TMP_DIR"
  exit 1
fi

# Calculate build size
BUILD_SIZE=$(stat -f%z "$IPA_PATH")
BUILD_TYPE="ipa"

# Construct the curl command
CURL_COMMAND="curl --request PUT \
  --url $API_URL/builds \
  --header 'Authorization: Bearer $API_KEY' \
  --form version_name=$VERSION_NAME \
  --form version_code=$VERSION_CODE \
  --form mapping_type=dsym \
  --form build_size=$BUILD_SIZE \
  --form build_type=$BUILD_TYPE \
  --form app_unique_id=$APP_UNIQUE_ID"

# Add each dSYM .tgz file to the curl command
for DSYM_TGZ in "${DSYM_TGZ_FILES[@]}"; do
  CURL_COMMAND="$CURL_COMMAND --form mapping_file=@$DSYM_TGZ"
done

# Execute the curl command
echo "Executing curl command..."
eval "$CURL_COMMAND"

# Clean up
rm -rf "$TMP_DIR"
for DSYM_TGZ in "${DSYM_TGZ_FILES[@]}"; do
  rm -f "$DSYM_TGZ"
done
