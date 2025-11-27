# Local Development Guide

This guide provides instructions on how to set up your local development environment and run the checks for each platform.

## Prerequisites

- **Node.js and Yarn:** For the React Native SDK and commit message linting.
- **Java and Gradle:** For the Android SDK.
- **Xcode and SwiftLint:** For the iOS SDK.
- **Flutter and Melos:** For the Flutter SDK.

## Running Checks

Before submitting a pull request, please make sure to run all the checks for the platform you are working on.

### Android

To run all the checks for the Android SDK, run the following command in the `android` directory:

```bash
./gradlew check
```

### iOS

To run the linter and tests for the iOS SDK, run the following commands from the root of the project:

```bash
# Lint
swiftlint --strict --config ios/.swiftlint.yml

# Test
xcodebuild test \
  -project ios/MeasureSDK.xcodeproj \
  -scheme MeasureSDKTests \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.4'
```

### React Native

To run the linter and tests for the React Native SDK, run the following commands in the `react-native` directory:

```bash
# Install dependencies
yarn install

# Lint
yarn lint

# Test
yarn test
```

### Flutter

To run the linter and tests for the Flutter SDK, run the following commands in the `flutter` directory:

```bash
# Install dependencies
dart pub global activate melos
melos bootstrap

# Lint
melos run analyze

# Test
melos run test:all
```

### Commit Messages

We use `commitlint` to enforce a consistent commit message format. The commit message will be linted automatically when you commit your changes, using a `pre-commit` hook.

```