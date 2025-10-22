#!/bin/bash

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
    fi
  done
}
trap cleanup EXIT

check_dependencies

if [ ! -d "$DSYM_FOLDER" ]; then
  echo "Error: dSYM folder not found at $DSYM_FOLDER"
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
  echo "Error: No dSYM files found in the folder"
  exit 1
fi

DSYM_JSON_MAPPINGS="$DSYM_JSON_MAPPINGS ]"

METADATA_FILE=$(mktemp)
TEMP_FILES+=("$METADATA_FILE")

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

echo "$JSON_PAYLOAD" > "$METADATA_FILE"

CURL_COMMAND_META="curl --request PUT \
  --url $API_URL/builds \
  --header 'Authorization: Bearer $API_KEY' \
  --header 'Content-Type: application/json'"

IFS='|' read -r -a CUSTOM_HEADERS <<< "$RAW_CUSTOM_HEADERS"
for HEADER in "${CUSTOM_HEADERS[@]}"; do
  if [ -n "$HEADER" ]; then
    CURL_COMMAND_META="$CURL_COMMAND_META --header '$HEADER'"
  fi
done

CURL_COMMAND_META="$CURL_COMMAND_META --data @$METADATA_FILE"

echo ""
echo "Uploading Build Metadata..."
RESPONSE_BODY_FILE=$(mktemp)
TEMP_FILES+=("$RESPONSE_BODY_FILE")

HTTP_STATUS_CODE=$(eval "$CURL_COMMAND_META --write-out '%{http_code}' --silent --output $RESPONSE_BODY_FILE")
HTTP_RESPONSE_BODY=$(cat "$RESPONSE_BODY_FILE")

if [[ "$HTTP_STATUS_CODE" -ne 200 && "$HTTP_STATUS_CODE" -ne 201 ]]; then
    echo "[ERROR]: Metadata upload failed with status code $HTTP_STATUS_CODE."
    exit 1
fi

echo ""
echo "Uploading dSYM files..."
UPLOAD_SUCCESS=true
MAX_ATTEMPTS=3

echo "$HTTP_RESPONSE_BODY" | jq -c '.mappings[]' | \
while IFS= read -r URL_OBJECT; do
    
    SIGNED_URL=$(echo "$URL_OBJECT" | jq -r '.upload_url')
    EXPECTED_FILENAME=$(echo "$URL_OBJECT" | jq -r '.filename')
    
    UPLOAD_HEADERS_CURL=""
    HEADER_LINES=$(echo "$URL_OBJECT" | jq -r '.headers | to_entries[] | "\(.key): \(.value)"')

    while IFS= read -r HEADER_LINE; do
        if [ -n "$HEADER_LINE" ]; then
            UPLOAD_HEADERS_CURL+=" --header \"$HEADER_LINE\""
        fi
    done <<< "$HEADER_LINES"
    
    if [ -z "$SIGNED_URL" ] || [ -z "$EXPECTED_FILENAME" ]; then
        echo "[ERROR]: Failed to extract SIGNED_URL or FILENAME from JSON object. Aborting remaining uploads."
        UPLOAD_SUCCESS=false
        break
    fi
    
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

    if ! $UPLOAD_ATTEMPT_SUCCESS; then
        UPLOAD_SUCCESS=false
    fi

done

if $UPLOAD_SUCCESS; then
    echo ""
    echo "✅ SUCCESS: All build metadata and dSYM files uploaded."
else
    echo ""
    echo "❌ FAILURE: One or more file uploads failed."
    exit 1
fi
