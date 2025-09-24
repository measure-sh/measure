#!/bin/bash

# Check if required parameters are provided
if [ "$#" -lt 7 ]; then
  echo "Usage: $0 <path_to_dsym_folder> <api_url> <api_key> <version_name> <version_code> <app_unique_id> <build_size> [custom_headers]"
  echo "Example: $0 dsym/ https://api.example.com abc123 1.0.0 42 com.example.app 123456 'X-Custom-1: val1|X-Custom-2: val2'"
  exit 1
fi

DSYM_FOLDER=$1
API_URL=$2
API_KEY=$3
VERSION_NAME=$4
VERSION_CODE=$5
APP_UNIQUE_ID=$6
BUILD_SIZE=$7
RAW_CUSTOM_HEADERS="$8"
BUILD_TYPE="ipa"
OS_NAME="ios"
SCRIPT_DIR=$(pwd)

# Validate dSYM folder
if [ ! -d "$DSYM_FOLDER" ]; then
  echo "Error: dSYM folder not found at $DSYM_FOLDER"
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
  echo "Error: No dSYM files found in the folder"
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
    echo "[ERROR]: Failed to upload mapping file to Measure, please check that correct api_key is provided. Stack traces will not be symbolicated."
    ;;
  413)
    echo "[ERROR]: Failed to upload mapping file to Measure, mapping file size exceeded the maximum allowed limit. Stack traces will not be symbolicated."
    ;;
  500)
    echo "[ERROR]: Failed to upload mapping file to Measure, the server encountered an error, try again later. Stack traces will not be symbolicated."
    ;;
  *)
    echo "Upload completed!"
    ;;
esac

# Cleanup
for DSYM_TGZ in "${DSYM_TGZ_FILES[@]}"; do
  rm -f "$DSYM_TGZ"
done