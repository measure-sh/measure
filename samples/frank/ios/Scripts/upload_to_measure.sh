#!/bin/bash

# Frank-only wrapper around the shared Measure uploader (ios/Scripts/upload_dsym_manual.sh).
#
# React Native source maps embed absolute build-machine paths in their "sources"
# array. This strips them (anchored on node_modules, matching the Android Gradle
# plugin's RewriteJsSourceMapTask) before delegating the upload, so the uploaded
# map carries project-relative paths instead of the local directory layout.
#
# Accepts the same arguments as upload_dsym_manual.sh and forwards them verbatim,
# rewriting only the --mapping file.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPLOAD_SCRIPT="$SCRIPT_DIR/../../../../ios/Scripts/upload_dsym_manual.sh"

if [[ ! -f "$UPLOAD_SCRIPT" ]]; then
  echo "error: upload_dsym_manual.sh not found at $UPLOAD_SCRIPT"
  exit 1
fi

TEMP_DIRS=()
cleanup() {
  for dir in "${TEMP_DIRS[@]}"; do
    rm -rf "$dir"
  done
}
trap cleanup EXIT

strip_source_map() {
  # Writes a path-stripped copy of $1 into a temp dir (preserving the basename so
  # the uploaded filename is unchanged) and echoes the new path. On any failure
  # it echoes the original path so the upload still proceeds.
  local map="$1"
  if [[ ! -f "$map" ]] || ! command -v jq &>/dev/null; then
    echo "$map"
    return
  fi

  local prefix
  prefix=$(jq -r '
    ((.sources // [])[] | select(contains("node_modules/"))) |
    split("node_modules/")[0]
  ' "$map" 2>/dev/null | head -1)

  if [[ -z "$prefix" ]]; then
    echo "warning: could not detect node_modules path prefix; uploading source map as-is." >&2
    echo "$map"
    return
  fi

  echo "Stripping source map path prefix: $prefix" >&2
  local out_dir
  out_dir=$(mktemp -d)
  TEMP_DIRS+=("$out_dir")
  local out="$out_dir/$(basename "$map")"
  jq --arg prefix "$prefix" '
    .sources |= map(
      if startswith($prefix) then
        .[$prefix | length:] | if . == "" then "unknown" else . end
      else
        (split("/") | map(select(. != "")) | last) // .
      end
    )
  ' "$map" > "$out"
  echo "$out"
}

ARGS=()
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --mapping)
      ARGS+=(--mapping "$(strip_source_map "$2")")
      shift 2 ;;
    *)
      ARGS+=("$1")
      shift ;;
  esac
done

bash "$UPLOAD_SCRIPT" "${ARGS[@]}"
