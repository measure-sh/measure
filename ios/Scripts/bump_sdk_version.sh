#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

# Get the release type from the first argument (major, minor, patch)
RELEASE_TYPE=$1

# File paths
FRAMEWORK_INFO_FILE="../Sources/MeasureSDK/Swift/FrameworkInfo.swift"
PODSPEC_FILE="../MeasureSDK.podspec"

# Function to get the current version from FrameworkInfo.swift
get_current_version() {
    grep -oE '[0-9]+\.[0-9]+\.[0-9]+' "$FRAMEWORK_INFO_FILE" | head -1
}

# Function to bump version
bump_version() {
    local version=$1
    local type=$2
    IFS='.' read -r major minor patch <<< "$version"

    case "$type" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            echo "Invalid release type: $type"
            exit 1
            ;;
    esac

    echo "$major.$minor.$patch"
}

# Get current version
CURRENT_VERSION=$(get_current_version)
echo "Current version: $CURRENT_VERSION"

# Get new version
NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$RELEASE_TYPE")
echo "New version: $NEW_VERSION"

# Update version in FrameworkInfo.swift
sed -i '' "s/static let version = \".*\"/static let version = \"$NEW_VERSION\"/" "$FRAMEWORK_INFO_FILE"

# Update version in podspec (Fix: Use a temp file method)
awk -v new_version="$NEW_VERSION" '/spec.version *= *"[0-9]+\.[0-9]+\.[0-9]+"/ { sub(/[0-9]+\.[0-9]+\.[0-9]+/, new_version); }1' "$PODSPEC_FILE" > temp_podspec && mv temp_podspec "$PODSPEC_FILE"

# Verify updates
grep "static let version" "$FRAMEWORK_INFO_FILE"
grep "spec.version" "$PODSPEC_FILE"

# Commit and push changes
# git add "$FRAMEWORK_INFO_FILE" "$PODSPEC_FILE"
# git commit -m "Release version $NEW_VERSION"
# git tag "v$NEW_VERSION"
# git push origin main --tags

echo "✅ Release $NEW_VERSION created successfully!"
