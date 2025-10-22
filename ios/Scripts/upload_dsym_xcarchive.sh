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
TEMP_FILES=()

check_dependencies() {
  if ! command -v jq &> /dev/null; then
    echo "Error: jq is required for JSON processing but is not installed."
    echo "Please install jq (e.g., 'brew install jq' or 'sudo apt-get install jq')."
    exit 1
  fi
}

cleanup() {
  echo "Cleaning up temporary files..."
  for temp_file in "${TEMP_FILES[@]}"; do
    if [ -f "$temp_file" ]; then
      rm -f "$temp_file"
      # echo "Removed $temp_file"
    fi
  done
}
trap cleanup EXIT

check_dependencies

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

DSYM_TGZ_FILES=()
DSYM_TGZ_BASENAMES=()
DSYM_JSON_MAPPINGS="["

INDEX=0
for DSYM_DIR in "$DSYM_FOLDER"/*.dSYM; do
  if [ -d "$DSYM_DIR" ]; then
    TGZ_BASENAME="$(basename "$DSYM_DIR").tgz"
    DSYM_TGZ="$SCRIPT_DIR/$TGZ_BASENAME"
    tar -czf "$DSYM_TGZ" -C "$DSYM_FOLDER" "$(basename "$DSYM_DIR")"
    
    DSYM_TGZ_FILES+=("$DSYM_TGZ")
    DSYM_TGZ_BASENAMES+=("$TGZ_BASENAME")
    TEMP_FILES+=("$DSYM_TGZ")

    if [ "$INDEX" -gt 0 ]; then
      DSYM_JSON_MAPPINGS="$DSYM_JSON_MAPPINGS,"
    fi
    
    DSYM_JSON_MAPPINGS="$DSYM_JSON_MAPPINGS {\"type\": \"dsym\", \"filename\": \"$TGZ_BASENAME\"}"
    
    INDEX=$((INDEX+1))
  fi
done

if [ "${#DSYM_TGZ_FILES[@]}" -eq 0 ]; then
  echo "Error: No dSYM files found in the xcarchive"
  exit 1
fi

DSYM_JSON_MAPPINGS="$DSYM_JSON_MAPPINGS ]" # Close JSON array

METADATA_FILE=$(mktemp)
TEMP_FILES+=("$METADATA_FILE")

# Construct the complete JSON payload
JSON_PAYLOAD=$(cat <<-END_JSON
{
  "version_name": "$VERSION_NAME",
  "version_code": "$VERSION_CODE",
  "build_size": $BUILD_SIZE,
  "build_type": "$BUILD_TYPE",
  "app_unique_id": "$APP_UNIQUE_ID",
  "os_name": "$OS_NAME",
  "mappings": $DSYM_JSON_MAPPINGS
}
END_JSON
)

# Save the JSON payload to the temporary file
echo "$JSON_PAYLOAD" > "$METADATA_FILE"

CURL_COMMAND_META="curl --request PUT \
  --url $API_URL/builds \
  --header 'Authorization: Bearer $API_KEY' \
  --header 'Content-Type: application/json'"

# Append custom headers if provided
IFS='|' read -r -a CUSTOM_HEADERS <<< "$RAW_CUSTOM_HEADERS"
for HEADER in "${CUSTOM_HEADERS[@]}"; do
  if [ -n "$HEADER" ]; then
    CURL_COMMAND_META="$CURL_COMMAND_META --header '$HEADER'"
  fi
done

CURL_COMMAND_META="$CURL_COMMAND_META --data @$METADATA_FILE"

# Execute Step 1: Get Pre-Signed URLs
echo ""
echo "Uploading Build Metadata..."
RESPONSE_BODY_FILE=$(mktemp)
TEMP_FILES+=("$RESPONSE_BODY_FILE")

# Execute curl command
HTTP_STATUS_CODE=$(eval "$CURL_COMMAND_META --write-out '%{http_code}' --silent --output $RESPONSE_BODY_FILE")
HTTP_RESPONSE_BODY=$(cat "$RESPONSE_BODY_FILE")

if [[ "$HTTP_STATUS_CODE" -ne 200 && "$HTTP_STATUS_CODE" -ne 201 ]]; then
    echo "[ERROR]: Metadata upload failed with status code $HTTP_STATUS_CODE."
    exit 1
fi

# --- Step 2: Upload files to Pre-Signed URLs ---
echo ""
echo "Uploading dSYM files..."
UPLOAD_SUCCESS=true
MAX_ATTEMPTS=3

echo "$HTTP_RESPONSE_BODY" | jq -c '.mappings[]' | \
while IFS= read -r URL_OBJECT; do
    
    # 1. Extract SIGNED_URL and EXPECTED_FILENAME
    SIGNED_URL=$(echo "$URL_OBJECT" | jq -r '.upload_url')
    EXPECTED_FILENAME=$(echo "$URL_OBJECT" | jq -r '.filename')
    
    # 2. Extract and format required file upload headers from the 'headers' object
    UPLOAD_HEADERS_CURL=""
    HEADER_LINES=$(echo "$URL_OBJECT" | jq -r '.headers | to_entries[] | "\(.key): \(.value)"')

    # Loop through the extracted header lines and format them for curl
    while IFS= read -r HEADER_LINE; do
        if [ -n "$HEADER_LINE" ]; then
            UPLOAD_HEADERS_CURL+=" --header \"$HEADER_LINE\""
        fi
    done <<< "$HEADER_LINES"
    
    # Simple validation check
    if [ -z "$SIGNED_URL" ] || [ -z "$EXPECTED_FILENAME" ]; then
        echo "[ERROR]: Failed to extract SIGNED_URL or FILENAME from JSON object: $URL_OBJECT. Aborting remaining uploads."
        UPLOAD_SUCCESS=false
        break
    fi
    
    # Find the local path of the file corresponding to the expected filename
    DSYM_TGZ_PATH=""
    for (( j=0; j<${#DSYM_TGZ_BASENAMES[@]}; j++ )); do
        if [ "${DSYM_TGZ_BASENAMES[$j]}" == "$EXPECTED_FILENAME" ]; then
            DSYM_TGZ_PATH="${DSYM_TGZ_FILES[$j]}"
            break
        fi
    done

    if [ -z "$DSYM_TGZ_PATH" ]; then
        echo "[WARNING]: Local dSYM file not found for filename $EXPECTED_FILENAME. Skipping upload."
        continue
    fi
    
    # --- Retry Logic ---
    UPLOAD_ATTEMPT_SUCCESS=false
    FILE_UPLOAD_COMMAND="curl --request PUT \
        --url \"$SIGNED_URL\" \
        --header 'Content-Type: application/octet-stream' \
        $UPLOAD_HEADERS_CURL \
        --write-out '%{http_code}' \
        --silent \
        --output /dev/null \
        --data-binary \"@$DSYM_TGZ_PATH\""

    for ATTEMPT in $(seq 1 $MAX_ATTEMPTS); do
        echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS: Uploading $EXPECTED_FILENAME..."
        
        FILE_UPLOAD_STATUS=$(eval "$FILE_UPLOAD_COMMAND")
        
        if [[ "$FILE_UPLOAD_STATUS" -ge 200 && "$FILE_UPLOAD_STATUS" -le 299 ]]; then
            echo "  [SUCCESS]: $EXPECTED_FILENAME uploaded on attempt $ATTEMPT. Status: $FILE_UPLOAD_STATUS"
            UPLOAD_ATTEMPT_SUCCESS=true
            break # Success, move to the next file
        else
            if [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; then
                echo "  [WARNING]: $EXPECTED_FILENAME upload failed (Status: $FILE_UPLOAD_STATUS). Retrying in 5 seconds..."
                sleep 5
            else
                echo "  [ERROR]: $EXPECTED_FILENAME upload failed after $MAX_ATTEMPTS attempts. Final Status: $FILE_UPLOAD_STATUS"
            fi
        fi
    done
    # --- End Retry Logic ---

    if ! $UPLOAD_ATTEMPT_SUCCESS; then
        UPLOAD_SUCCESS=false # Mark overall upload as failed
    fi

done # End of while loop processing signed URLs

# Final Summary
if $UPLOAD_SUCCESS; then
    echo ""
    echo "✅ SUCCESS: All build metadata and dSYM files uploaded."
else
    echo ""
    echo "❌ FAILURE: One or more file uploads failed."
    exit 1
fi
