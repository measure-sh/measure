#!/usr/bin/env bash
# Merges per-device recordings (each with its own manifest.json) into one.
#
#   merge-recordings.sh <out-dir> <dir>...
#
# Each <dir> is either a recording or a folder of recordings, since
# download-artifact unpacks a lone artifact without its own subfolder.
set -euo pipefail

out=$1
shift
mkdir -p "$out"

parts=()
for dir in "$@"; do
  if [[ -f "$dir/manifest.json" ]]; then
    parts+=("$dir")
    continue
  fi
  for sub in "$dir"/*/; do
    sub=${sub%/}
    if [[ -f "$sub/manifest.json" ]]; then
      parts+=("$sub")
    else
      echo "skipping $sub: no manifest.json (recording didn't finish)" >&2
    fi
  done
done

manifests=()
for part in ${parts[@]+"${parts[@]}"}; do
  manifests+=("$part/manifest.json")
  # Each device writes only under its own <device>/ dir.
  for dev in "$part"/*/; do
    cp -R "${dev%/}" "$out/"
  done
done

if [[ ${#manifests[@]} -eq 0 ]]; then
  echo "no finished recordings to merge" >&2
  exit 1
fi

keys=$(jq -r .key "${manifests[@]}" | sort -u)
if [[ $(wc -l <<<"$keys") -ne 1 ]]; then
  echo "recordings are for different keys: $keys" >&2
  exit 1
fi

# The first manifest's key, commit and time, plus every device's specs.
jq -s '.[0] + {specs: (map(.specs) | add)}' "${manifests[@]}" >"$out/manifest.json"
jq -c '{key, specs: (.specs | map_values(keys))}' "$out/manifest.json"
