#!/usr/bin/env bash
# Merges per-device recordings (each with its own manifest.json) into one.
#
#   merge-recordings.sh <out-dir> <part-dir>...
set -euo pipefail

out=$1
shift
mkdir -p "$out"

manifests=()
for part in "$@"; do
  if [[ ! -f "$part/manifest.json" ]]; then
    echo "skipping $part: no manifest.json (recording didn't finish)" >&2
    continue
  fi
  manifests+=("$part/manifest.json")
  # Each device writes only under its own <device>/ dir.
  for dir in "$part"/*/; do
    cp -R "${dir%/}" "$out/"
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
