#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PACKAGE_SWIFT="$ROOT/flutter/packages/measure_flutter/ios/measure_flutter/Package.swift"
PODSPEC="$ROOT/flutter/packages/measure_flutter/ios/measure_flutter.podspec"

SPM_VERSION=$(grep -o 'branch: "ios-v[0-9.]*"' "$PACKAGE_SWIFT" | sed 's/branch: "ios-v\(.*\)"/\1/')
POD_VERSION=$(grep -o "s.dependency 'measure-sh', '~> [0-9.]*'" "$PODSPEC" | sed "s/.*~> \([0-9.]*\)'/\1/")

if [ -z "$SPM_VERSION" ]; then
  echo "error: no ios-v tag pin found in $PACKAGE_SWIFT"
  exit 1
fi
if [ -z "$POD_VERSION" ]; then
  echo "error: no versioned measure-sh dependency found in $PODSPEC"
  exit 1
fi
if [ "$SPM_VERSION" != "$POD_VERSION" ]; then
  echo "error: native SDK pin mismatch: Package.swift pins ios-v$SPM_VERSION, podspec pins ~> $POD_VERSION"
  exit 1
fi
if ! git ls-remote --exit-code https://github.com/measure-sh/measure.git "refs/tags/ios-v$SPM_VERSION" >/dev/null; then
  echo "error: tag ios-v$SPM_VERSION does not exist on github.com/measure-sh/measure"
  exit 1
fi

echo "iOS SDK pins consistent: ios-v$SPM_VERSION (SPM tag and podspec agree, tag exists on origin)"
