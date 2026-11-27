#!/usr/bin/env bash
# Prints the key a recording is valid for: a hash of every committed input
# that changes what the SDK sends during the Maestro flows. A recording made
# at one commit can be replayed at any other commit with the same key.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

inputs=(
  android
  ios
  flutter
  kmp
  react-native
  Package.swift
  measure-sh.podspec
  samples/frank
  e2e-tests/maestro
  e2e-tests/recording/sdk-config.json
)

for path in "${inputs[@]}"; do
  echo "$path $(git rev-parse "HEAD:$path")"
done | git hash-object --stdin | cut -c1-16
