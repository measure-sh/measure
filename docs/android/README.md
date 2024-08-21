# Measure Android SDK

* [Minimum requirements](#minimum-requirements)
* [Quick reference](#quick-reference)
* [Getting started](#getting-started)
* [Custom events](#custom-events)
  * [Handled exceptions](#handled-exceptions)
  * [Navigation](#navigation)
* [Features](#features)
* [Benchmarks](#benchmarks)

# Minimum requirements

| Name                  | Version       |
|-----------------------|---------------|
| Android Gradle Plugin | 7.4           |
| Min SDK               | 21 (Lollipop) |
| Target SDK            | 31            |

# Quick reference

A quick reference to the entire public API for Measure Android SDK.

<img src="https://github.com/user-attachments/assets/ff835b3b-2953-4920-b5fa-060761862cac" width="60%" alt="Cheatsheet">


# Getting started

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
    id("sh.measure.android.gradle") version "0.5.0"
}
```

or, use the following if you're using `build.gradle`.

```groovy
plugins {
    id 'sh.measure.android.gradle' version '0.5.0'
}
```

[Read](gradle-plugin.md) more about Measure gradle plugin.

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


### 3. Add Measure SDK

Add the following to your app's `build.gradle.kts`file.

```kotlin
implementation("sh.measure:measure-android:0.6.0")
```

or, add the following to your app's `build.gradle`file.

```groovy
implementation 'sh.measure:measure-android:0.6.0'
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
    context, MeasureConfig(
        // override the default configuration here
    )
)
```

See all the [configuration options](configuration-options.md) available.

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

# Custom events

The following events can be triggered manually to get more context while debugging issues.

### Handled exceptions

To track exceptions which were caught and handled by the app, use the `trackHandledException`
method.

```kotlin
try {
    methodThatThrows()
} catch (e: Exception) {
    Measure.trackHandledException(e)
}
```

### Navigation

Measure automatically tracks `navigation` events
for [androidx.navigation](https://developer.android.com/jetpack/androidx/releases/navigation)
library. It also
tracks [lifecycle_activity](features/feature_navigation_and_lifecycle.md#activity-lifecycle)
events
and [lifecycle_fragment](features/feature_navigation_and_lifecycle.md#fragment-lifecycle)
events.

However, `navigation` events can also be triggered manually using the following method to keep
a track of the user flow.

```kotlin
Measure.trackNavigationEvent(
    from = "home",
    to = "settings"
)
```

# Features

All the features supported by the Measure SDK are listed below. 

* [Crash tracking](features/feature_crash_tracking.md)
* [ANR tracking](features/feature_anr_tracking.md)
* [Network monitoring](features/feature_network_monitoring.md)
* [Network changes](features/feature_network_changes.md)
* [Gesture tracking](features/feature_gesture_tracking.md)
* [Navigation & Lifecycle](features/feature_navigation_and_lifecycle.md)
* [App launch](features/feature_app_launch.md)
* [App exit info](features/feature_app_exit_info.md)
* [CPU monitoring](features/feature_cpu_monitoring.md)
* [Memory monitoring](features/feature_memory_monitoring.md)
* [App size](features/feature_app_size.md)

# Benchmarks

Measure SDK has a set of benchmarks to measure the performance impact of the SDK on the app.
These benchmarks are collected using macro-benchmark on a Pixel 4a device running Android 13 (API 33).
Each benchmark is run 35 times. See the [android/benchmarks](../../android/benchmarks/README.md) for
more details, and the raw results are available in the 
[android/benchmarkData](../../android/benchmarks/README.md) folder.

> [!IMPORTANT]
> Benchmark results are specific to the device and the app. It is recommended to run the benchmarks
> for your app to get results specific to your app. These numbers are published to provide
> a reference point and are used internally to detect any performance regressions.

For v0.2.0, the following benchmarks are available.

* Adds 22.772ms-33.512ms to the app startup time (Time to Initial Display) for a simple app.
* Takes 0.30ms to find the target view for every click/scroll gesture in a deep view hierarchy.
* Takes 0.45ms to find the target composable for every click/scroll gesture in a deep composable
  hierarchy.
