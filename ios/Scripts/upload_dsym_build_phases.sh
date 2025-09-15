#!/bin/bash

# Ensure script is called with api_url and api_key parameters
if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <api_url> <api_key> [custom_headers]"
    echo "Example: $0 https://api.example.com abc123 'X-Custom-Header1: val1|X-Custom-Header2: val2'"
    exit 1
fi

# Assign parameters
api_url="$1"
api_key="$2"
raw_custom_headers="$3"

# Set hardcoded values
BUILD_TYPE="ipa"

# Collect version name and version code from the Info.plist
INFO_PLIST="${TARGET_BUILD_DIR}/${INFOPLIST_PATH}"
VERSION_NAME=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$INFO_PLIST" 2>/dev/null)
VERSION_CODE=$(/usr/libexec/PlistBuddy -c "Print CFBundleVersion" "$INFO_PLIST" 2>/dev/null)

# Path to the app bundle
APP_BUNDLE_PATH="${TARGET_BUILD_DIR}/${FULL_PRODUCT_NAME}"

# Print key paths
echo "TARGET_BUILD_DIR=${TARGET_BUILD_DIR}"
echo "FULL_PRODUCT_NAME=${FULL_PRODUCT_NAME}"
echo "APP_BUNDLE_PATH=${APP_BUNDLE_PATH}"
echo "INFO_PLIST=${INFO_PLIST}"

# Ensure app bundle exists before proceeding
if [ ! -d "$APP_BUNDLE_PATH" ]; then
    echo "Error: App bundle not found at $APP_BUNDLE_PATH"
    exit 1
fi

# Calculate build size using `du` (disk usage)
BUILD_SIZE=$(du -sk "$APP_BUNDLE_PATH" | awk '{print $1}')
BUILD_SIZE=$((BUILD_SIZE * 1024)) # Convert kilobytes to bytes

# Locate all dSYM files in the build directory
echo "Searching for dSYM files in ${DWARF_DSYM_FOLDER_PATH}"
DSYM_FILES=($(find "${DWARF_DSYM_FOLDER_PATH}" -name "*.dSYM" -type d))

if [ ${#DSYM_FILES[@]} -eq 0 ]; then
    echo "Error: No dSYM files found in ${DWARF_DSYM_FOLDER_PATH}"
    exit 1
fi

# Log found dSYM files with full paths
echo "Found dSYM files:"
for DSYM in "${DSYM_FILES[@]}"; do
    FULL_DSYM_PATH=$(realpath "$DSYM")
    echo "  - $FULL_DSYM_PATH"
done

# Compress dSYM files to .tgz format
TGZ_FILES=()
for DSYM in "${DSYM_FILES[@]}"; do
    TGZ_FILE="$(basename "$DSYM").tgz"
    echo "Compressing $DSYM to $(pwd)/$TGZ_FILE"
    
    tar -czf "$TGZ_FILE" -C "$(dirname "$DSYM")" "$(basename "$DSYM")"
    
    if [ -f "$TGZ_FILE" ]; then
        echo "Successfully created $(pwd)/$TGZ_FILE"
        TGZ_FILES+=("$(pwd)/$TGZ_FILE")
    else
        echo "Error: Failed to create $(pwd)/$TGZ_FILE"
        exit 1
    fi
done

# Print generated .tgz files
echo "Generated dSYM archives:"
for TGZ in "${TGZ_FILES[@]}"; do
    echo "  - $TGZ"
done

OS_NAME="ios"

# Start building the curl command
CURL_COMMAND="curl --request PUT \
  --url $api_url/builds \
  --header 'Authorization: Bearer $api_key' \
  --header 'Content-Type: multipart/form-data'"

# Parse and add custom headers if any
IFS='|' read -r -a CUSTOM_HEADERS <<< "$raw_custom_headers"
for HEADER in "${CUSTOM_HEADERS[@]}"; do
    if [ -n "$HEADER" ]; then
        CURL_COMMAND="$CURL_COMMAND --header '$HEADER'"
    fi
done

# Add form fields
CURL_COMMAND="$CURL_COMMAND \
  --form version_name=$VERSION_NAME \
  --form version_code=$VERSION_CODE \
  --form build_size=$BUILD_SIZE \
  --form build_type=$BUILD_TYPE \
  --form os_name=$OS_NAME"

# Attach each dSYM .tgz file
INDEX=0
for DSYM_TGZ in "${TGZ_FILES[@]}"; do
  CURL_COMMAND="$CURL_COMMAND \
    --form mappings[$INDEX].type=dsym \
    --form mappings[$INDEX].filename=@$DSYM_TGZ"
  INDEX=$((INDEX+1))
done

# Execute the curl command
eval "$CURL_COMMAND"

# Clean up generated .tgz files
for TGZ in "${TGZ_FILES[@]}"; do
    echo "Removing $TGZ"
    rm -f "$TGZ"
done

echo "Script execution completed."