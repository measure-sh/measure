#!/bin/bash

# Checkout the documentation for more details https://github.com/measure-sh/measure/blob/main/docs/features/feature-upload-symbols.md#ios.

if [ "$#" -lt 7 ]; then
  echo "Usage: $0 <path_to_dsym_folder> <api_url> <api_key> <version_name> <version_code> <app_unique_id> <build_size> [options]"
  echo ""
  echo "Options:"
  echo "  --bundle <path>          Path to the JS bundle file (.jsbundle)"
  echo "  --mapping <path>         Path to the JS source map file (.map)"
  echo "  --custom-headers <str>   Custom request headers (pipe-separated, e.g. 'X-H1: v1|X-H2: v2')"
  echo ""
  echo "Example: $0 dsym/ https://api.example.com abc123 1.0.0 42 com.example.app 123456 --bundle main.jsbundle --mapping main.jsbundle.map"
  exit 1
fi

DSYM_FOLDER=$1
API_URL=$2
API_KEY=$3
VERSION_NAME=$4
VERSION_CODE=$5
APP_UNIQUE_ID=$6
BUILD_SIZE=$7
BUILD_TYPE="ipa"
OS_NAME="ios"
SCRIPT_DIR=$(pwd)
TEMP_FILES=()

BUNDLE_PATH=""
MAPPING_PATH=""
RAW_CUSTOM_HEADERS=""

# Parse optional named args from position 8 onwards
shift 7
while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle)
      BUNDLE_PATH="$2"; shift 2 ;;
    --mapping)
      MAPPING_PATH="$2"; shift 2 ;;
    --custom-headers)
      RAW_CUSTOM_HEADERS="$2"; shift 2 ;;
    *)
      echo "Unknown option: $1"; exit 1 ;;
  esac
done

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

if [ -n "$BUNDLE_PATH" ] && [ ! -f "$BUNDLE_PATH" ]; then
  echo "Error: Bundle file not found at $BUNDLE_PATH"
  exit 1
fi

if [ -n "$MAPPING_PATH" ] && [ ! -f "$MAPPING_PATH" ]; then
  echo "Error: Mapping file not found at $MAPPING_PATH"
  exit 1
fi

# --- Build mappings JSON and tarballs ---

ALL_TGZ_FILES=()
ALL_TGZ_BASENAMES=()
JSON_MAPPINGS="["
INDEX=0

# dSYM tarballs — one per .dSYM directory
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
  if [ -z "$BUNDLE_PATH" ] && [ -z "$MAPPING_PATH" ]; then
    echo "Error: No dSYM files found and no --bundle or --mapping provided. Nothing to upload."
    exit 1
  fi
  echo "No dSYM files found — uploading JS files only."
fi

# JS bundle tarball — bundle file only
if [ -n "$BUNDLE_PATH" ]; then
  BUNDLE_BASENAME="$(basename "$BUNDLE_PATH")"
  BUNDLE_TGZ_BASENAME="${BUNDLE_BASENAME}.tgz"
  BUNDLE_TGZ="$SCRIPT_DIR/$BUNDLE_TGZ_BASENAME"
  BUNDLE_DIR="$(dirname "$BUNDLE_PATH")"
  tar -czf "$BUNDLE_TGZ" -C "$BUNDLE_DIR" "$BUNDLE_BASENAME"

  ALL_TGZ_FILES+=("$BUNDLE_TGZ")
  ALL_TGZ_BASENAMES+=("$BUNDLE_TGZ_BASENAME")
  TEMP_FILES+=("$BUNDLE_TGZ")

  if [ "$INDEX" -gt 0 ]; then
    JSON_MAPPINGS="$JSON_MAPPINGS,"
  fi
  JSON_MAPPINGS="$JSON_MAPPINGS {\"type\": \"jsbundle\", \"filename\": \"$BUNDLE_TGZ_BASENAME\"}"
  INDEX=$((INDEX+1))
fi

# JS mapping tarball — mapping file only
if [ -n "$MAPPING_PATH" ]; then
  MAPPING_BASENAME="$(basename "$MAPPING_PATH")"
  MAPPING_TGZ_BASENAME="${MAPPING_BASENAME}.tgz"
  MAPPING_TGZ="$SCRIPT_DIR/$MAPPING_TGZ_BASENAME"
  MAPPING_DIR="$(dirname "$MAPPING_PATH")"
  tar -czf "$MAPPING_TGZ" -C "$MAPPING_DIR" "$MAPPING_BASENAME"

  ALL_TGZ_FILES+=("$MAPPING_TGZ")
  ALL_TGZ_BASENAMES+=("$MAPPING_TGZ_BASENAME")
  TEMP_FILES+=("$MAPPING_TGZ")

  if [ "$INDEX" -gt 0 ]; then
    JSON_MAPPINGS="$JSON_MAPPINGS,"
  fi
  JSON_MAPPINGS="$JSON_MAPPINGS {\"type\": \"jsbundle\", \"filename\": \"$MAPPING_TGZ_BASENAME\"}"
  INDEX=$((INDEX+1))
fi

JSON_MAPPINGS="$JSON_MAPPINGS ]"

# --- Upload build metadata ---

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
  "mappings": $JSON_MAPPINGS
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

case "$HTTP_STATUS_CODE" in
  200|201)
    ;;
  401)
    echo "Failed to upload build info, please check the api-key. Stack traces will not be symbolicated."
    exit 1
    ;;
  413)
    echo "Failed to upload build info, build size exceeded the maximum allowed limit. Stack traces will not be symbolicated."
    exit 1
    ;;
  500)
    echo "Failed to upload build info, the server encountered an error, try again later. Stack traces will not be symbolicated."
    exit 1
    ;;
  *)
    echo "Metadata upload failed with unexpected status code $HTTP_STATUS_CODE."
    exit 1
    ;;
esac

# --- Upload all files via pre-signed URLs ---

UPLOAD_SUCCESS_FLAG=$(mktemp)
TEMP_FILES+=("$UPLOAD_SUCCESS_FLAG")
echo "success" > "$UPLOAD_SUCCESS_FLAG"

echo ""
echo "Uploading files..."
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
        echo "[ERROR]: Failed to read response from server. Stack traces will not be symbolicated."
        echo "failure" > "$UPLOAD_SUCCESS_FLAG"
        break
    fi

    TGZ_PATH=""
    for (( j=0; j<${#ALL_TGZ_BASENAMES[@]}; j++ )); do
        if [ "${ALL_TGZ_BASENAMES[$j]}" == "$EXPECTED_FILENAME" ]; then
            TGZ_PATH="${ALL_TGZ_FILES[$j]}"
            break
        fi
    done

    if [ -z "$TGZ_PATH" ]; then
        echo "[ERROR]: No local file found for $EXPECTED_FILENAME. Stack traces will not be symbolicated."
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

        FILE_UPLOAD_STATUS=$(eval "$FILE_UPLOAD_COMMAND")

        if [[ "$FILE_UPLOAD_STATUS" -ge 200 && "$FILE_UPLOAD_STATUS" -le 299 ]]; then
            echo "  [SUCCESS]: $EXPECTED_FILENAME uploaded on attempt $ATTEMPT. Status: $FILE_UPLOAD_STATUS"
            UPLOAD_ATTEMPT_SUCCESS=true
            break
        else
            if [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; then
                sleep 1
            else
                echo "[ERROR]: Failed to upload ($EXPECTED_FILENAME) after $MAX_ATTEMPTS attempts with status code: $FILE_UPLOAD_STATUS. Stack traces will not be symbolicated."
            fi
        fi
    done

    if ! $UPLOAD_ATTEMPT_SUCCESS; then
        echo "failure" > "$UPLOAD_SUCCESS_FLAG"
    fi

done

FINAL_STATUS=$(cat "$UPLOAD_SUCCESS_FLAG")

if [ "$FINAL_STATUS" == "success" ]; then
    echo ""
    echo "✅ Successfully uploaded files to Measure."
else
    echo ""
    echo "❌ Failed to upload one or more files. Stack traces will not be symbolicated."
    exit 1
fi
