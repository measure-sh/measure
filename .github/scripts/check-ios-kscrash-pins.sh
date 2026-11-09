#!/usr/bin/env bash
# Usage: check-ios-kscrash-pins.sh
#
# Fails unless every file that names a KSCrash version pins the same exact
# version. Apps resolve KSCrash from Package.swift and measure-sh.podspec,
# while CI and local builds use the SDK project pin and the DemoApp lockfile,
# so a mismatch means the SDK is tested against a version apps don't get.
# Run from the repository root.

set -euo pipefail

status=0
versions=()

fail() {
  echo "::error file=$1::$2"
  status=1
}

record() {
  printf '  %-45s %s\n' "$1" "$2"
  versions+=("$2")
}

# Package.swift: .package(url: ".../KSCrash.git", exact: "x.y.z")
file=Package.swift
line=$(grep -E 'KSCrash\.git"' "$file" || true)
version=$(sed -nE 's/.*KSCrash\.git",[[:space:]]*exact:[[:space:]]*"([^"]+)".*/\1/p' <<<"$line")
if [[ -z $version ]]; then
  fail "$file" "KSCrash must be pinned with exact: \"x.y.z\", found: ${line:-nothing}"
else
  record "$file" "$version"
fi

# measure-sh.podspec: spec.dependency "KSCrash", "x.y.z"
file=measure-sh.podspec
line=$(grep -E 'dependency[[:space:]]+"KSCrash"' "$file" || true)
version=$(sed -nE 's/^[[:space:]]*spec\.dependency[[:space:]]+"KSCrash",[[:space:]]*"([0-9][^" ]*)"[[:space:]]*$/\1/p' <<<"$line")
if [[ -z $version ]]; then
  fail "$file" "KSCrash must be pinned to a single exact version like \"x.y.z\", found: ${line:-nothing}"
else
  record "$file" "$version"
fi

# SDK project: the KSCrash package reference must be exactVersion.
file=ios/MeasureSDK.xcodeproj/project.pbxproj
block=$(awk 'index($0, "XCRemoteSwiftPackageReference \"KSCrash\" */ = {") { found = 1 } found { print } found && $0 == "\t\t};" { exit }' "$file")
kind=$(sed -nE 's/^[[:space:]]*kind = ([^;]+);/\1/p' <<<"$block")
version=$(sed -nE 's/^[[:space:]]*version = "?([^";]+)"?;/\1/p' <<<"$block")
if [[ $kind != exactVersion || -z $version ]]; then
  fail "$file" "KSCrash package reference must use exactVersion, found kind: ${kind:-nothing}"
else
  record "$file" "$version"
fi

# DemoApp lockfile: the KSCrash version CocoaPods resolved.
file=ios/DemoApp/Podfile.lock
version=$(sed -nE 's/^  - KSCrash \(([^)]+)\):?$/\1/p' "$file")
if [[ -z $version ]]; then
  fail "$file" "no resolved KSCrash version found"
else
  record "$file" "$version"
fi

unique=$(printf '%s\n' "${versions[@]}" | sort -u)
if [[ $(wc -l <<<"$unique") -gt 1 ]]; then
  echo "::error::KSCrash versions don't match: $(tr '\n' ' ' <<<"$unique")"
  status=1
fi

if [[ $status -eq 0 ]]; then
  echo "KSCrash is pinned to $unique everywhere."
fi

exit $status
