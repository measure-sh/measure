# Introduction

We know first hand that building great mobile applications is hard. Understanding how they are
performing in production
is even harder. We are building a tool we wish existed when we were building and
monitoring mobile apps. We
are excited to share our progress with you, and we hope you will join us on this journey.

Measure Android SDK automatically instruments your app to capture errors, logs and metrics that
help you answer questions about your app in production.

### Minimum Requirements

| Name                  | Minimum Version   |
|-----------------------|-------------------|
| Android Gradle Plugin | 7.4               |
| Android SDK           | API 21 (Lollipop) |

# Getting Started

### 1. Create a Measure account

If you haven't already, [create a Measure account](https://measure.sh/auth/login) and follow the
instructions on the website to create your first app and grab the API key.

### 2. Add the API Key

Copy the API Key and add it to `AndroidManifest.xml` file.

```xml

<application>
    <meta-data android:name="sh.measure.android.API_KEY" android:value="YOUR_API_KEY" />
</application>
```

<details>
  <summary>Configure API Keys for different build types</summary>

You can also
use [manifestPlaceholders](https://developer.android.com/build/manage-manifests#inject_build_variables_into_the_manifest)
to configure measure API key for different build types.

In the `build.gradle.kts` file:

```kotlin
android {
    buildTypes {
        debug {
            manifestPlaceholders["measureApiKey"] = "YOUR_API_KEY"
        }
        release {
            manifestPlaceholders["measureApiKey"] = "YOUR_API_KEY"
        }
    }
}
```

or in the `build.gradle` file:

```groovy
android {
    buildTypes {
        debug {
            manifestPlaceholders = ["measureApiKey": "YOUR_API_KEY"]
        }
        release {
            manifestPlaceholders = ["measureApiKey": "YOUR_API_KEY"]
        }
    }
}
```

Then add the following in the `AndroidManifest.xml` file:

```xml

<application>
    <meta-data android:name="sh.measure.android.API_KEY" android:value="${measureApiKey}" />
</application>
```

</details>

### 3. Add the Measure gradle plugin

Add the following plugin to your project.

```kotlin
plugins {
    id("sh.measure.android.gradle") version "0.1.0"
}
```

or, use the following if you're using `build.gradle`.

```groovy
plugins {
    id 'sh.measure.android.gradle' version '0.1.0'
}
```

[Read](measure-gradle-plugin/README.md) more about Measure gradle plugin.

### 4. Add Measure SDK to your project

Add the following to your app's `build.gradle.kts`file.

[//]: # (TODO: Replace with the actual version on maven central)

```kotlin
implementation("sh.measure:measure-android:0.1.0")
```

or, add the following to your app's `build.gradle`file.

```groovy
implementation 'sh.measure:measure-android:0.1.0'
```

### 5. Verify

Launch the app on any device or emulator. Kill and reopen. You should see a session in the
Measure dashboard.

🎉 Congratulations, you have successfully integrated Measure into your app!

# Features

* [Crash tracking](docs/features/feature_crash_tracking.md)
* [ANR tracking](docs/features/feature_anr_tracking.md)
* [Network monitoring](docs/features/feature_network_monitoring.md)
* [Gesture tracking](docs/features/feature_gesture_tracking.md)
* [Screen transitions](docs/features/feature_screen_transitions.md)
* [App launch metrics](docs/features/feature_app_launch_metrics.md)
* [App exit info](docs/features/feature_app_exit_info.md)
* [CPU monitoring](docs/features/feature_cpu_monitoring.md)
* [Memory monitoring](docs/features/feature_memory_monitoring.md)

# Configure the SDK

Coming soon...