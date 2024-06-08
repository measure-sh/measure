# Introduction

We know first hand that building great mobile applications is hard. Understanding how they are
performing in production
is even harder. We are building a tool we wish existed when we were building and
monitoring mobile apps. We
are excited to share our progress with you, and we hope you will join us on this journey.

Measure Android SDK automatically instruments your app to capture errors, logs and metrics that
help you answer questions about your app in production.

### Minimum Requirements

| Name                  | Minimum Version |
|-----------------------|-----------------|
| Android Gradle Plugin | 7.4             |
| Min SDK               | 21 (Lollipop)   |
| Target SDK            | 31              |

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

[Read](measure-android-gradle/README.md) more about Measure gradle plugin.

### 4. Add Measure SDK to your project

Add the following to your app's `build.gradle.kts`file.

[//]: # (TODO: Replace with the actual version on maven central)

```kotlin
implementation("sh.measure:measure-android:0.2.0")
```

or, add the following to your app's `build.gradle`file.

```groovy
implementation 'sh.measure:measure-android:0.2.0'
```

### 5. Initialize the SDK

Add the following to your app's Application class. Ideally, done as soon as `Application.onCreate` is
called to allow tracking events as early as possible.

```kotlin
Measure.init(context)
```

If you wish to configure the SDK during initialization with a custom config use the overloaded function:

```kotlin
Measure.init(
    this, MeasureConfig(
        // override the default config values here
    )
)
```

See all the [configuration options](#configure-the-sdk) available below.

### 6. Verify

Launch the app on any device or emulator. Kill and reopen. You should see a session in the
Measure dashboard.

🎉 Congratulations, you have successfully integrated Measure into your app!

# Features

* [Crash tracking](docs/features/feature_crash_tracking.md)
* [ANR tracking](docs/features/feature_anr_tracking.md)
* [Network monitoring](docs/features/feature_network_monitoring.md)
* [Network changes](docs/features/feature_network_changes.md)
* [Gesture tracking](docs/features/feature_gesture_tracking.md)
* [Navigation & Lifecycle](docs/features/feature_navigation_and_lifecycle.md)
* [App launch](docs/features/feature_app_launch.md)
* [App exit info](docs/features/feature_app_exit_info.md)
* [CPU monitoring](docs/features/feature_cpu_monitoring.md)
* [Memory monitoring](docs/features/feature_memory_monitoring.md)

# Configure the SDK

The following configuration options are available in the SDK.

## Screenshot Options

Measure captures a screenshot of the app as soon as it crashes due to an unhandled exception or an
ANR. This screenshot is sent to the server as
an [attachment](../../../docs/api/sdk/README.md#attachments) along with
the crash report.

The following configs are available to control this feature:

### `trackScreenshotOnCrash`

Whether to capture a screenshot of the app when it crashes due to an unhandled exception or ANR.
Defaults to `true`.

### `screenshotMaskLevel`

[Allows changing the masking level of screenshots to prevent sensitive
information from leaking.
See [Configuring masking level](docs/features/feature_screenshot.md#configuring-masking-level)
for all the options available.]()

It defaults
to [ScreenshotMaskLevel.AllTextAndMedia](docs/features/feature_screenshot.md#maskalltextandmedia)

## Http Options

Measure collects `http` events along with with request/response body & headers. The following
configuration options are available to control this feature:

### `httpUrlBlocklist`

Allows disabling collection of `http` events for certain URLs. This is useful to setup if you do not
want to collect data for certain endpoints or third party domains.
See [Http URL blocklist](docs/features/feature_network_monitoring.md#httpheadersblocklist) for
more.

### `trackHttpHeaders`

Allows enabling/disabling capturing of HTTP request and response headers. Disabled by default.

### `httpHeadersBlocklist`

Allows specifying HTTP headers which should not be captured.
See [HTTP headers blocklist](docs/features/feature_network_monitoring.md#httpHeadersBlocklist)

By default all common headers which contain sensitive information like `Authorization` are never
collected.
See [HTTP headers blocklist](docs/features/feature_network_monitoring.md#httpHeadersBlocklist) for
more.

### `trackHttpBody`

Allows enabling/disabling capturing of HTTP request and response body. Disabled by default.

## Intent data options

Android [Intent](https://developer.android.com/reference/android/content/Intent#standard-extra-data)
can contain
a bundle with any arbitrary information. While this can be useful to debug certain issues which
require
checking what data was passed as part of the bundle, it might also contain sensitive information.

The following configurations are available:

### `trackLifecycleActivityIntentData`

Allows enabling/disabling of collection of intent data for the following events:
* `lifecycle_activity.created` event, which is collected with the Activity lifecycle event `onCreate` is triggered.
* `cold_launch` event, which is collected when the app is launched from a cold start.
* `warm_launch` event, which is collected when the app is launched from a warm start.
* `hot_launch` event, which is collected when the app is launched from a hot start.

Disabled by default.

# Internals

* [Architecture](docs/internals/architecture)