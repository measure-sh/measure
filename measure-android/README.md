# Measure - Android SDK

* [Getting Started](#getting-started)
* [Features](#features)
* [Configure the SDK](#configure-the-sdk)
* [Custom Events](#custom-events)
* [Benchmarks](#benchmarks)
* [Internals](#internals)

# Minimum Requirements

| Name                  | Version       |
|-----------------------|---------------|
| Android Gradle Plugin | 7.4           |
| Min SDK               | 21 (Lollipop) |
| Target SDK            | 31            |

# Getting Started

Once you have access to the dashboard, create a new app and follow the steps below:

### 1. Add the API Key & API URL

Copy the API Key and API URL from the dashboard and add it to `AndroidManifest.xml` file.

```xml

<application>
    <meta-data android:name="sh.measure.android.API_KEY" android:value="YOUR_API_KEY" />
    <meta-data android:name="sh.measure.android.API_URL" android:value="API_URL" />
</application>
```

<details>
  <summary>Configure API Keys for different build types</summary>

You can also
use [manifestPlaceholders](https://developer.android.com/build/manage-manifests#inject_build_variables_into_the_manifest)
to configure different values for different build types or flavors.

In the `build.gradle.kts` file:

```kotlin
android {
    buildTypes {
        debug {
            manifestPlaceholders["measureApiKey"] = "YOUR_API_KEY"
            manifestPlaceholders["measureUrlKey"] = "API_URL"
        }
        release {
            manifestPlaceholders["measureApiKey"] = "YOUR_API_KEY"
            manifestPlaceholders["measureUrlKey"] = "API_URL"
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
            manifestPlaceholders = ["measureUrlKey": "API_URL"]
        }
        release {
            manifestPlaceholders = ["measureApiKey": "YOUR_API_KEY"]
            manifestPlaceholders = ["measureUrlKey": "API_URL"]
        }
    }
}
```

Then add the following in the `AndroidManifest.xml` file:

```xml

<application>
    <meta-data android:name="sh.measure.android.API_KEY" android:value="${measureApiKey}" />
    <meta-data android:name="sh.measure.android.API_URL" android:value="${measureUrlKey}" />
</application>
```

</details>

### 2. Add the Measure gradle plugin

Add the following plugin to your project.

```kotlin
plugins {
    id("sh.measure.android.gradle") version "0.3.0"
}
```

or, use the following if you're using `build.gradle`.

```groovy
plugins {
    id 'sh.measure.android.gradle' version '0.3.0'
}
```

[Read](measure-android-gradle/README.md) more about Measure gradle plugin.

<details>
  <summary>Configure variants</summary>

By default, the plugin is applied to all variants. To disable plugin for specific variants, 
use the `measure` block in your build file.

> [!IMPORTANT]
> Setting `enabled` to `false` will disable the plugin for that variant. This prevents the
> plugin to collect `mapping.txt` file and other build information about the app. Features like
> tracking app size, de-obfuscating stack traces, etc. will not work.

For example to disable the plugin for `debug` variants, add the following to your 
`build.gradle.kts` file:

```kotlin
measure {
  variantFilter {
    if (name.contains("debug")) {
      enabled = false
    }
  }
}
```

or in the `build.gradle` file:

```groovy
measure {
  variantFilter {
    if (name.contains("debug")) {
      enabled = false
    }
  }
}
```

</details>


### 3. Add Measure SDK to your project

Add the following to your app's `build.gradle.kts`file.

[//]: # (TODO: Replace with the actual version on maven central)

```kotlin
implementation("sh.measure:measure-android:0.3.0")
```

or, add the following to your app's `build.gradle`file.

```groovy
implementation 'sh.measure:measure-android:0.3.0'
```

### 4. Initialize the SDK

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

### 5. Verify

The SDK automatically collects data when a crash occurs. You can verify if the SDK is working by triggering a crash
after the SDK is initialized:

```kotlin
throw RuntimeException("This is a test crash")
```
Reopen the app and launch the dashboard, you should see the crash report in the dashboard.

> [!CAUTION]
> Make sure to remove the test crash code before releasing the app to production.

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

### `trackActivityIntentData`

Allows enabling/disabling of collection of intent data for the following events:

* `lifecycle_activity.created` event, which is collected with the Activity lifecycle
  event `onCreate` is triggered.
* `cold_launch` event, which is collected when the app is launched from a cold start.
* `warm_launch` event, which is collected when the app is launched from a warm start.
* `hot_launch` event, which is collected when the app is launched from a hot start.

Disabled by default.

### `sessionSamplingRate`

Allows setting a sampling rate for non-crashed sessions. Defaults to 1.0, meaning all non-crashed 
sessions are exported by default.

The sampling rate is a value between 0 and 1. For example, a value of `0.1` will export only 10%
of the non-crashed sessions, a value of `0` will disable exporting of non-crashed sessions.

Note that crashed sessions are always exported. And certain events like `cold_launch`, `warm_launch`,
`hot_launch` are always exported regardless of the sampling rate.

# Custom Events

The following events can be triggered manually to get more context while debugging issues.

## Handled Exceptions

To track exceptions which were caught and handled by the app, use the `trackHandledException`
method.

```kotlin
try {
    methodThatThrows()
} catch (e: Exception) {
    Measure.trackHandledException(e)
}
```

## Navigation

Measure automatically tracks `navigation` events
for [androidx.navigation](https://developer.android.com/jetpack/androidx/releases/navigation)
library. It also
tracks [lifecycle_activity](docs/features/feature_navigation_and_lifecycle.md#activity-lifecycle)
events
and [lifecycle_fragment](docs/features/feature_navigation_and_lifecycle.md#fragment-lifecycle)
events.

However, `navigation` events can also be triggered manually using the following method to keep
a track of the user flow.

```kotlin
Measure.trackNavigationEvent(
    from = "home",
    to = "settings"
)
```

# Benchmarks

Measure SDK has a set of benchmarks to measure the performance impact of the SDK on the app.
These benchmarks are collected using macro-benchmark on a Pixel 4a device running Android 13 (API 33).
Each benchmark is run 35 times. See the [benchmarks](benchmarks/README.md) for
more details, and the raw results are available in the 
[benchmarks/benchmarkData](benchmarks/benchmarkData) folder.

> [!IMPORTANT]
> Benchmark results are specific to the device and the app. It is recommended to run the benchmarks
> for your app to get results specific to your app. These numbers are published to provide
> a reference point and are used internally to detect any performance regressions.

For v0.2.0, the following benchmarks are available.

* Adds 22.772ms-33.512ms to the app startup time (Time to Initial Display) for a simple app.
* Takes 0.30ms to find the target view for every click/scroll gesture in a deep view hierarchy.
* Takes 0.45ms to find the target composable for every click/scroll gesture in a deep composable
  hierarchy.

# Internals

* [Architecture](docs/internals/architecture)