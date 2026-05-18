#!/usr/bin/env bash
#
# Builds Measure.xcframework from ios/Sources for measure-kmp's cinterop.
# Relies on xcodebuild's own DerivedData-based incremental build — no
# script-level freshness check. Trades ~5–15s on a no-op rerun for "always
# correct" (the previous bash gate missed Xcode project/workspace edits and
# script-flag changes, silently shipping stale frameworks).
#
# Why this is a shell script and not a Gradle task:
# When invoked from Xcode's Run Script build phase, a child process inherits
# Xcode's build-system env vars (BUILD_DIR, OBJROOT, BUILT_PRODUCTS_DIR, …).
# A nested xcodebuild that inherits those vars contends with the parent
# Xcode IDE's XCBBuildService session and crashes with
# "The Xcode build system has crashed. Build again to continue."
# We sidestep this by invoking xcodebuild via `env -i PATH=$PATH HOME=$HOME`
# so the nested build is fully isolated from the parent Xcode env.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KMP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_SDK_DIR="$(cd "$KMP_DIR/../../ios" && pwd)"
OUTPUT_DIR="$KMP_DIR/build/xcframework"
DEVICE_ARCHIVE="$OUTPUT_DIR/Measure-ios.xcarchive"
SIMULATOR_ARCHIVE="$OUTPUT_DIR/Measure-sim.xcarchive"
XCFRAMEWORK="$OUTPUT_DIR/Measure.xcframework"
# DerivedData lives under build/ so it gets cleaned by `./gradlew clean`
# and doesn't leak into the user's global ~/Library Xcode cache.
DERIVED_DATA="$OUTPUT_DIR/DerivedData"

mkdir -p "$OUTPUT_DIR"

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
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
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
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
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
