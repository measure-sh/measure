#!/usr/bin/env bash
# Records the e2e SDK traffic on this Mac and publishes it for CI, which
# replays it until the recording key changes. Needs devices (see README) and
# `gh` logged in with write access. Skips the recording if CI already has one
# for this key.
#
#   e2e-tests/upload-recording.sh            # record + upload if missing
#   e2e-tests/upload-recording.sh --force    # re-record and replace
set -euo pipefail

cd "$(git rev-parse --show-toplevel)/e2e-tests"
TAG=e2e-recordings
KEY=$(./recording-key.sh)
ASSET="e2e-recording-$KEY.tar.gz"

if [[ -n "$(git status --porcelain -- ..)" ]]; then
  echo "working tree is dirty; the key only covers committed files" >&2
  exit 1
fi

if [[ "${1:-}" != "--force" ]] &&
  gh release view "$TAG" --json assets -q '.assets[].name' 2>/dev/null | grep -qx "$ASSET"; then
  echo "$ASSET already published"
  exit 0
fi

DIR=$(mktemp -d)
npm start -- --record "$DIR/recording" --seed-gallery
tar -czf "$DIR/$ASSET" -C "$DIR/recording" .

gh release view "$TAG" >/dev/null 2>&1 ||
  gh release create "$TAG" --prerelease --title "E2E recordings" \
    --notes "SDK traffic recorded by e2e-tests/upload-recording.sh, replayed by .github/workflows/e2e-replay.yml." --target main
gh release upload "$TAG" "$DIR/$ASSET" --clobber
echo "published $ASSET"
