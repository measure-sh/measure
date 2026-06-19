#!/usr/bin/env bash
#
# Builds Measure.xcframework from the native iOS SDK sources. measure-kmp's
# cinterop binds against it for headers only; the binary is not linked (see
# the cinterop block in build.gradle.kts).
#
# Runs as a shell script rather than a Gradle task because Xcode's Run Script
# phase (used by the Frank sample) exports build-system env vars such as
# BUILD_DIR and OBJROOT. A nested xcodebuild that inherits them contends with
# the parent XCBBuildService and crashes, so run_xcodebuild isolates the child
# with `env -i`.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KMP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Native iOS SDK sources. Defaults to in-repo ios/; release sets MEASURE_IOS_SRC
# to a pinned ios-v<version> checkout.
IOS_SDK_DIR="$(cd "${MEASURE_IOS_SRC:-$KMP_DIR/../../ios}" && pwd)"
OUTPUT_DIR="$KMP_DIR/build/xcframework"
DEVICE_ARCHIVE="$OUTPUT_DIR/Measure-ios.xcarchive"
SIMULATOR_ARCHIVE="$OUTPUT_DIR/Measure-sim.xcarchive"
XCFRAMEWORK="$OUTPUT_DIR/Measure.xcframework"
# DerivedData lives under build/ so it gets cleaned by `./gradlew clean`
# and doesn't leak into the user's global ~/Library Xcode cache.
DERIVED_DATA="$OUTPUT_DIR/DerivedData"

mkdir -p "$OUTPUT_DIR"

# In CI the xcframework is built once up front; later Xcode Run Script
# invocations (e.g. the Frank app build) reuse it instead of rebuilding.
# $CI is unset locally, so local dev always builds.
if [ -d "$XCFRAMEWORK" ] && [ "${CI:-}" = "true" ]; then
  echo "Measure.xcframework already present in CI, skipping rebuild"
  exit 0
fi

run_xcodebuild() {
  env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    /usr/bin/xcrun xcodebuild "$@"
}

cd "$IOS_SDK_DIR"

run_xcodebuild archive \
  -workspace Measure.xcworkspace \
  -scheme Measure \
  -destination 'generic/platform=iOS' \
  -archivePath "$DEVICE_ARCHIVE" \
  -derivedDataPath "$DERIVED_DATA" \
  SKIP_INSTALL=NO \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY=

run_xcodebuild archive \
  -workspace Measure.xcworkspace \
  -scheme Measure \
  -destination 'generic/platform=iOS Simulator' \
  -archivePath "$SIMULATOR_ARCHIVE" \
  -derivedDataPath "$DERIVED_DATA" \
  SKIP_INSTALL=NO \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY=

# xcodebuild -create-xcframework refuses to overwrite an existing output.
rm -rf "$XCFRAMEWORK"
run_xcodebuild -create-xcframework \
  -framework "$DEVICE_ARCHIVE/Products/Library/Frameworks/Measure.framework" \
  -framework "$SIMULATOR_ARCHIVE/Products/Library/Frameworks/Measure.framework" \
  -output "$XCFRAMEWORK"

echo "Built $XCFRAMEWORK"
