# KMP Sample App

A playground for testing Kotlin Multiplatform projects with the Android and iOS Measure SDKs.

## Versioning

Both the Android and iOS apps use the version of their respective native Measure SDK as the display version:

- **Android**: `versionName` is read from the `measure-android` version in `gradle/libs.versions.toml`.
- **iOS**: `CFBundleShortVersionString` is read from `MEASURE_IOS_SDK_VERSION` in `iosApp/Configuration/Config.xcconfig`.

The build number (Android `versionCode`, iOS `CFBundleVersion`) is the git commit count, so it increments automatically with each commit.
