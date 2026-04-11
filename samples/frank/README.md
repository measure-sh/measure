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
* **Flutter SDK** (>= 3.38.0)
* **Node.js** and **npm**
* **CocoaPods** (`gem install cocoapods`)

## First-time Setup

#### 1. Set up Measure SDK config

Copy `.env.example` to `.env` and fill in the values:

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

#### 3. Set up Flutter module

```bash
cd flutter
flutter pub get
cd ..
```

This generates the `.android/` and `.ios/` integration directories required by
the Gradle and CocoaPods build systems.

#### 4. Set up React Native module

```bash
cd react_native
npm install
cd ..
```

#### 5. Set up iOS dependencies

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

`settings.gradle.kts` uses Gradle composite builds to include the Android SDK
and Gradle plugin from source:

```kotlin
includeBuild("../../android/measure-android-gradle")
includeBuild("../../android") { name = "measure-android" }
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

### iOS

The Podfile uses a local path to the `measure-sh` podspec at the repo root:

```ruby
pod 'measure-sh', :path => '../../..'
```

CocoaPods resolves source files relative to this path, so changes to the iOS
SDK are picked up on the next Xcode build without needing to `pod update`.

## CI/CD

CI is handled by `.github/workflows/frank.yml`. It triggers on PRs and pushes to main when changes are made to `samples/frank/`, `android/`, `ios/`, `flutter/`, or `react-native/`. Each run builds both debug and release for Android and iOS. On push to main, it also publishes to Firebase App Distribution (`measure-devs` group).

### CI Secrets

| Secret | Purpose |
|--------|---------|
| `FRANK_APP_ENV` | Contents of the `.env` file (Measure keys/URL) |
| `FRANK_APP_GOOGLE_SERVICES_JSON` | Android `google-services.json` content |
| `FRANK_APP_GOOGLE_SERVICE_INFO_PLIST_DEBUG` | iOS debug `GoogleService-Info.plist` content |
| `FRANK_APP_GOOGLE_SERVICE_INFO_PLIST_RELEASE` | iOS release `GoogleService-Info.plist` content |
| `FRANK_APP_FIREBASE_SERVICE_ACCOUNT` | Service account JSON for Firebase App Distribution |
| `FRANK_APP_IOS_CERTIFICATE_P12_DEBUG` | Base64-encoded p12 development certificate |
| `FRANK_APP_IOS_CERTIFICATE_PASSWORD_DEBUG` | Password for the debug p12 certificate |
| `FRANK_APP_IOS_CERTIFICATE_P12_RELEASE` | Base64-encoded p12 distribution certificate |
| `FRANK_APP_IOS_CERTIFICATE_PASSWORD_RELEASE` | Password for the release p12 certificate |
| `FRANK_APP_IOS_PROVISIONING_PROFILE_DEBUG` | Base64-encoded development provisioning profile |
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
