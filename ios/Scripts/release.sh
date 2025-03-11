#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

# Get the release type from the first argument (major, minor, patch)
RELEASE_TYPE=$1

# File paths
FRAMEWORK_INFO_FILE="ios/Sources/MeasureSDK/Swift/FrameworkInfo.swift"
PODSPEC_FILE="MeasureSDK.podspec"
README_FILE="ios/README.md"

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

# Ensure release type is provided
if [[ -z "$RELEASE_TYPE" ]]; then
    echo "❌ Error: Please specify release type (major, minor, patch)."
    exit 1
fi

# Get current version
CURRENT_VERSION=$(get_current_version)
echo "🔹 Current version: $CURRENT_VERSION"

# Get new version
NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$RELEASE_TYPE")
echo "🚀 New version: $NEW_VERSION"

# Update version in FrameworkInfo.swift
sed -i '' "s/static let version = \".*\"/static let version = \"$NEW_VERSION\"/" "$FRAMEWORK_INFO_FILE"

# Update version in podspec
awk -v new_version="$NEW_VERSION" '/spec.version *= *"[0-9]+\.[0-9]+\.[0-9]+"/ { sub(/[0-9]+\.[0-9]+\.[0-9]+/, new_version); }1' "$PODSPEC_FILE" > temp_podspec && mv temp_podspec "$PODSPEC_FILE"

# Update version in README.md for Swift Package Manager instructions
sed -E -i '' "s|(\\.package\\(url: \"https://github.com/measure-sh/measure.git\", branch: \"ios-v)[0-9]+\.[0-9]+\.[0-9]+(\")|\1$NEW_VERSION\2|g" "$README_FILE"

# Verify updates
echo "🔍 Verifying updates..."
grep "static let version" "$FRAMEWORK_INFO_FILE"
grep "spec.version" "$PODSPEC_FILE"
grep 'branch: "ios-v' "$README_FILE"

# Ask user if they want to generate the changelog
read -p "📝 Do you want to generate the changelog? (y/n): " generate_changelog

if [[ "$generate_changelog" == "y" ]]; then
    read -p "🔑 Enter GitHub Token (or press Enter to skip): " -s GITHUB_TOKEN
    echo  

    echo "📝 Generating changelog..."
    
    if [[ -z "$GITHUB_TOKEN" ]]; then
        git-cliff -c ios/cliff.toml -o ios/CHANGELOG.md --tag "ios-v$NEW_VERSION"
    else
        git-cliff -c ios/cliff.toml -o ios/CHANGELOG.md --tag "ios-v$NEW_VERSION" --github-token "$GITHUB_TOKEN"
    fi

    echo "✅ Changelog updated."
else
    echo "❌ Skipping changelog generation."
    exit 0
fi

# Commit message
COMMIT_MESSAGE="chore(ios): prepare sdk release $NEW_VERSION"
echo "📝 Commit message: $COMMIT_MESSAGE"

# Ask user if they want to create tag and push changes
read -p "🚀 Do you want to create a tag and push changes? (y/n): " push_changes

if [[ "$push_changes" == "y" ]]; then
    echo "🚀 Committing and pushing changes..."
    git add .
    git commit -m "$COMMIT_MESSAGE"
    git tag -a "ios-v$NEW_VERSION" -m "ios-v$NEW_VERSION"
    git push origin main --tags
    echo "✅ Release $NEW_VERSION created and pushed successfully!"
else
    echo "❌ Skipping git actions. Exiting."
    exit 0
fi
