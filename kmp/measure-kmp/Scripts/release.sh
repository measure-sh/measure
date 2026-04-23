#!/bin/bash

set -e

RELEASE_TYPE=$1

GRADLE_PROPS_FILE="kmp/measure-kmp/gradle.properties"

get_current_version() {
    grep "MEASURE_KMP_VERSION_NAME=" "$GRADLE_PROPS_FILE" | cut -d'=' -f2 | sed 's/-SNAPSHOT//'
}

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

if [[ -z "$RELEASE_TYPE" ]]; then
    echo "❌ Error: Please specify release type (major, minor, patch)."
    exit 1
fi

if [[ ! -f "$GRADLE_PROPS_FILE" ]]; then
    echo "❌ Error: Run this script from the repo root."
    exit 1
fi

CURRENT_VERSION=$(get_current_version)
echo "🔹 Current version: $CURRENT_VERSION"

NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$RELEASE_TYPE")
echo "🚀 New version: $NEW_VERSION"

sed -i '' "s/^MEASURE_KMP_VERSION_NAME=.*/MEASURE_KMP_VERSION_NAME=$NEW_VERSION/" "$GRADLE_PROPS_FILE"

echo "🔍 Verifying updates..."
grep "MEASURE_KMP_VERSION_NAME=" "$GRADLE_PROPS_FILE"

read -p "📝 Do you want to generate the changelog? (y/n): " generate_changelog

if [[ "$generate_changelog" == "y" ]]; then
    read -p "🔑 Enter GitHub Token (or press Enter to skip): " -s GITHUB_TOKEN
    echo

    echo "📝 Generating changelog..."

    if [[ -z "$GITHUB_TOKEN" ]]; then
        git-cliff -c kmp/cliff.toml -o kmp/CHANGELOG.md --tag "kmp-v$NEW_VERSION"
    else
        git-cliff -c kmp/cliff.toml -o kmp/CHANGELOG.md --tag "kmp-v$NEW_VERSION" --github-token "$GITHUB_TOKEN"
    fi

    echo "✅ Changelog updated."
else
    echo "❌ Skipping changelog generation."
    exit 0
fi
