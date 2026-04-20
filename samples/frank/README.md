# Sample App

* [Prerequisites](#prerequisites)
* [First-time Setup](#first-time-setup)
* [Building](#building)
* [How SDKs are linked](#how-sdks-are-linked)
* [Project Structure](#project-structure)

A sample app that integrates every cross-platform technology supported by the
Measure SDK into a single Android and iOS application. Each app presents a
home screen with navigation to screens built using different frameworks,
demonstrating that the Measure SDK works correctly across all of them.

Both apps include screens built with:

* **Native** — Kotlin + Jetpack Compose (Android), Swift + UIKit/SwiftUI (iOS)
* **Kotlin Multiplatform** — Shared UI with Compose Multiplatform
* **Flutter** — Add-to-app module
* **React Native** — Embedded screen

## Prerequisites

* **JDK 17**
* **Flutter SDK**
* **Node.js** and **Yarn**
* **CocoaPods** (`gem install cocoapods`)

## First-time Setup

#### 1. Set up Measure SDK config

Copy the example env file and fill in the Measure SDK keys:

```bash
cp .env.example .env
```

Then run the setup script:

```bash
./setup-secrets.sh
```

This reads the `.env` file and generates:
* `local.properties` — Measure API keys for the Android build
* `ios/MeasureDebug.xcconfig` — Measure API keys for the iOS debug build
* `ios/MeasureRelease.xcconfig` — Measure API keys for the iOS release build

#### 2. Set up Firebase

Firebase config files are not checked in. Download them from the
[Firebase Console](https://console.firebase.google.com/) for the project and
place them at the following paths:

**Android:**
```
android/app/google-services.json
```

The file should contain clients for both `sh.frankenstein.android` and
`sh.frankenstein.android.debug` package names.

**iOS:**
```
ios/FrankensteinApp/Firebase/Debug/GoogleService-Info.plist
ios/FrankensteinApp/Firebase/Release/GoogleService-Info.plist
```

The iOS build has a script phase that copies the correct plist based on the
build configuration (Debug/Release).

#### 3. Build Measure React Native SDK

The React Native SDK is linked from local source (`link:../../../react-native`)
but the JS entry point is a build artifact (`lib/module/index.js`). Build it
first:

```bash
cd ../../react-native
yarn install
npx bob build --target module
cd ../samples/frank
```

#### 4. Set up Flutter module

```bash
cd flutter
flutter pub get
cd ..
```

This generates the `.android/` and `.ios/` integration directories required by
the Gradle and CocoaPods build systems.

#### 5. Set up React Native module

```bash
cd react_native
yarn install
cd ..
```

#### 6. Set up iOS dependencies

```bash
cd ios
pod install
cd ..
```

CocoaPods pulls in the Flutter pods, React Native pods, the KMP shared
framework, and the Measure SDK. Always open the **workspace**
(`ios/FrankensteinApp.xcworkspace`), not the `.xcodeproj`.

## Building

### Android

```bash
./gradlew :android:app:assembleDebug
```

The Gradle build handles Flutter and KMP module integration automatically.

### iOS

Open `ios/FrankensteinApp.xcworkspace` in Xcode and build the `FrankensteinApp` scheme.

## How SDKs are linked

All Measure SDKs are linked to **local source** so that changes anywhere in the
monorepo are picked up automatically on the next build — no publishing step
required.

### Android

`settings.gradle.kts` uses a Gradle composite build to include the Android SDK
from source:

```kotlin
includeBuild("../../android/measure-android")
```

The app module then depends on it as a Maven coordinate that Gradle resolves
from the included build:

```kotlin
implementation("sh.measure:measure-android:0.18.0-SNAPSHOT")
```

A `subprojects` block in the root `build.gradle.kts` overrides JVM targets to
17 for all modules. This is necessary because some autolinked libraries (e.g.
the RN SDK, Flutter SDK) declare Java 11 in their own build files, which
conflicts with the Kotlin plugin's default JVM target.

### React Native

`react_native/package.json` uses a `link:` dependency to symlink the RN SDK:

```json
"@measuresh/react-native": "link:../../../react-native"
```

The symlink means changes to the RN SDK source are visible immediately. The
native Android code is compiled from source via React Native autolinking
(configured in `settings.gradle.kts`). The native iOS code is pulled in via
the SDK's podspec through `use_react_native!` in the Podfile.

### Flutter

`flutter/pubspec.yaml` uses path dependencies:

```yaml
measure_flutter:
  path: ../../../flutter/packages/measure_flutter
measure_dio:
  path: ../../../flutter/packages/measure_dio
```

On Android, the Flutter module is included as a Gradle subproject via
Flutter's plugin loader (`settings.gradle.kts`). On iOS, it's integrated
through CocoaPods via `install_all_flutter_pods` in the Podfile.

### Kotlin Multiplatform

`samples/frank/kmp` consumes `sh.measure:measure-kmp` via the
`includeBuild("../../kmp/measure-kmp")` composite build in `settings.gradle.kts`.
The KMP module exposes the Measure SDK to common Kotlin code by linking against
the native Android SDK on Android and against an iOS xcframework via cinterop
on iOS.

The iOS xcframework is built by `kmp/measure-kmp/Scripts/build-xcframework.sh`,
which wraps `xcodebuild archive` + `xcodebuild -create-xcframework`. It is
invoked automatically by:

* a Run Script build phase ("Build Measure iOS XCFramework") on the
  `FrankensteinApp` target, before the Gradle phase that compiles the KMP
  shared module — so local Xcode builds pick up iOS SDK changes transparently.
* the `kmp-release.yml` CI workflow, before any Gradle invocation that needs
  the framework.

The script invokes `xcodebuild` in a sanitized environment
(`env -i PATH=$PATH HOME=$HOME …`) so a nested invocation can never contend
with the parent Xcode build's `XCBBuildService` daemon. The script also
short-circuits if the existing `Measure.xcframework` is newer than every file
under `ios/Sources`, so unchanged builds add no overhead.

### iOS

The Podfile uses a local path to the `measure-sh` podspec at the repo root:

```ruby
pod 'measure-sh', :path => '../../..'
```

CocoaPods resolves source files relative to this path, so changes to the iOS
SDK are picked up on the next Xcode build without needing to `pod update`.

## CI/CD

CI is handled by `.github/workflows/frank.yml`. It triggers on PRs and pushes to `main` when changes are made to `samples/frank/`, `android/`, `ios/`, `flutter/`, or `react-native/`. Each run builds both debug and release for Android and a release archive for iOS. On merge to `main`, it also publishes to Firebase App Distribution (`measure-devs` group). Android uses the `wzieba/Firebase-Distribution-Github-Action` while iOS uses the Firebase CLI directly (since the GitHub Action requires a Linux runner).

### CI Secrets

| Secret | Purpose |
|--------|---------|
| `FRANK_APP_ENV` | Contents of the `.env` file. Frank ships as two separate Measure apps (Android, iOS), so this must contain both `FRANK_MEASURE_ANDROID_*` and `FRANK_MEASURE_IOS_*` key/URL variables — see `.env.example`. |
| `FRANK_APP_GOOGLE_SERVICES_JSON` | Android `google-services.json` content |
| `FRANK_APP_GOOGLE_SERVICE_INFO_PLIST_RELEASE` | iOS release `GoogleService-Info.plist` content |
| `FRANK_APP_FIREBASE_SERVICE_ACCOUNT` | Service account JSON for Firebase App Distribution |
| `FRANK_APP_IOS_CERTIFICATE_P12_RELEASE` | Base64-encoded p12 distribution certificate |
| `FRANK_APP_IOS_CERTIFICATE_PASSWORD_RELEASE` | Password for the release p12 certificate |
| `FRANK_APP_IOS_PROVISIONING_PROFILE_RELEASE` | Base64-encoded ad-hoc provisioning profile |

## Project Structure

```
frank/
├── android/app/       # Native Android app (Kotlin + Compose)
├── flutter/           # Flutter add-to-app module
├── ios/               # Native iOS app (Swift + UIKit/SwiftUI)
├── kmp/               # Kotlin Multiplatform shared module (Compose Multiplatform)
├── react_native/      # React Native module
├── build.gradle.kts   # Root Gradle build
└── settings.gradle.kts
```

## Troubleshooting

### `npm install` fails for the React Native module

`react_native/package.json` uses the `link:` protocol to symlink the Measure
React Native SDK from local source. `npm` does not support `link:` and will
fail with `EUNSUPPORTEDPROTOCOL`. Use `yarn install` instead.

### `pod install` fails cloning Firebase

This is a known git + HTTP/2 issue when cloning large repositories like
`firebase-ios-sdk`. CocoaPods clones into a temp directory, so a repo-level
git config won't help — the setting must be global. Temporarily switch git to
HTTP/1.1, run pod install, then revert:

```bash
git config --global http.version HTTP/1.1
pod install
git config --global --unset http.version
```

### `The Xcode build system has crashed. Build again to continue.`

Symptom: an iOS Frank build fails with this message and exit-65 from a nested
`xcodebuild` invocation. This happens when something inside Xcode's build
session shells out to `xcodebuild` with the parent build's env vars
(`BUILD_DIR`, `OBJROOT`, `BUILT_PRODUCTS_DIR`, …) inherited; the nested
invocation contends with the parent's `XCBBuildService` and crashes.

The KMP xcframework script
(`kmp/measure-kmp/Scripts/build-xcframework.sh`) avoids this by wrapping its
`xcodebuild` calls in `env -i PATH=$PATH HOME=$HOME`. If the symptom recurs,
verify the script still does this and that the "Build Measure iOS XCFramework"
Run Script phase is ordered *before* "Build Shared KMP Framework" on the
`FrankensteinApp` target.

### `configs.toReversed is not a function` during Android release build

This error means the Gradle daemon inherited a PATH with an older Node.js
that lacks `Array.prototype.toReversed()` (requires Node 20+). Stop all
daemons and rebuild:

```bash
./gradlew --stop
./gradlew :android:app:assembleRelease
```
