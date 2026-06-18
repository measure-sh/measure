# React Native SDK for measure.sh

Mobile apps break, get to the root cause faster.

Measure is an open source tool to monitor mobile apps. This package contains the React Native SDK
which helps instrumenting your app easily.

Some features include:

- Capture JS crashes and native crashes automatically
- Monitor app health metrics such as launch times, crash rates and app sizes
- Get screenshots with crash reports
- View full event timelines of sessions with auto-tracked user interactions, navigation events, http
  calls, cpu usage, memory usage and more for deeper context
- Collect bug reports directly from users and manage them on the dashboard
- Optimize performance with traces
- Track custom events with additional business specific attributes
- Track handled exceptions explicitly

## Integration

### Install the SDK

Go to [measure.sh](https://measure.sh), create an app and generate your API key and API URL. Then install the package:

```sh
npm install @measuresh/react-native
```

### Expo

The easiest way to integrate Measure in an Expo app is via the config plugin. Add the plugin to
your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      [
        "@measuresh/react-native",
        {
          "androidApiKey": "YOUR_ANDROID_API_KEY",
          "androidApiUrl": "YOUR_ANDROID_API_URL",
          "iosApiKey": "YOUR_IOS_API_KEY",
          "iosApiUrl": "YOUR_IOS_API_URL"
        }
      ]
    ]
  }
}
```

Then run prebuild to apply the plugin:

```sh
npx expo prebuild
```

The plugin automatically:
- Adds the native iOS and Android SDKs
- Injects API credentials
- Initializes the SDK in `AppDelegate` (iOS) and `MainApplication` (Android)
- Adds `MeasureOkHttpApplicationInterceptor` for automatic HTTP tracking on Android
- Sets up a build phase to upload symbol files after each iOS Release build

### Vanilla React Native

#### Android

Add the API key and URL to your `AndroidManifest.xml`:

```xml
<application>
    <meta-data android:name="sh.measure.android.API_KEY" android:value="YOUR_API_KEY"/>
    <meta-data android:name="sh.measure.android.API_URL" android:value="YOUR_API_URL"/>
</application>
```

Add the Gradle plugin to your project-level `build.gradle`:

```groovy
buildscript {
    repositories {
        gradlePluginPortal()
    }
    dependencies {
        classpath("sh.measure.android.gradle:sh.measure.android.gradle.gradle.plugin:0.14.0")
    }
}
```

Add the SDK dependency and apply the plugin in your app-level `build.gradle`:

```groovy
dependencies {
    implementation("sh.measure:measure-android:0.19.0")
}

apply plugin: "sh.measure.android.gradle"
```

Register `MeasurePackage` in `MainApplication.kt`:

```kotlin
import sh.measure.rn.MeasurePackage

override fun getPackages(): List<ReactPackage> {
    val packages = PackageList(this).packages
    packages.add(MeasurePackage())
    return packages
}
```

#### iOS

Add the pod to your `Podfile`:

```ruby
pod 'MeasureReactNative', :path => '../node_modules/@measuresh/react-native'
```

Initialize the SDK in `AppDelegate.swift`:

```swift
import MeasureSDK

// inside application(_:didFinishLaunchingWithOptions:)
MeasureReactNative.initialize(
    apiKey: "YOUR_API_KEY",
    apiUrl: "YOUR_API_URL",
    config: BaseMeasureConfig(enableFullCollectionMode: true)
)
```

Or in `AppDelegate.mm` (Objective-C):

```objc
#import <MeasureReactNative/MeasureReactNative.h>

// inside application:didFinishLaunchingWithOptions:
[MeasureReactNative initializeWithApiKey:@"YOUR_API_KEY"
                                  apiUrl:@"YOUR_API_URL"];
```

To upload symbol files after each Release build, add a Run Script phase in Xcode after the
"Bundle React Native code and images" phase:

```sh
export SOURCEMAP_FILE="$(pwd)/main.jsbundle.map"
"$SRCROOT/../node_modules/@measuresh/react-native/scripts/upload_build_phase.sh" "YOUR_API_URL" "YOUR_API_KEY"
```

### Initialize the SDK

After native setup, initialize Measure in your JavaScript entry point:

```js
import { Measure, MeasureConfig } from '@measuresh/react-native';

Measure.init({
  config: new MeasureConfig({}),
});
```

### Verify Installation

Launch the app with the SDK integrated and navigate through a few screens. Data is sent to the
server periodically, so it may take a few seconds to appear. Check the `Usage` section in the
dashboard or navigate to the `Sessions` tab to see sessions being tracked.

## Documentation

Checkout our [documentation](https://measure.sh/docs) to learn more about Measure.
