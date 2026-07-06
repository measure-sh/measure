---
title: "Mobile App Profiling"
description: "Auto-capture heap dumps and perfetto traces from Android apps using the platform's trigger-based profiling APIs."
---

# Profiling

- [Introduction](#introduction)
- [Enable profiling](#enable-profiling)
- [Triggers](#triggers)
- [Sampling](#sampling)
- [How It Works](#how-it-works)

## Introduction

Measure can capture Perfetto system traces and heap dumps and attaches them to your session timeline. They let you dig into exactly what the app was doing at a specific moment, for example when it finished launching or became unresponsive.

> [!NOTE]  
> Profiling is currently available on Android only. It requires Android 16 (API level 36) or higher and is a no-op on older versions.

## Enable profiling

Profiling is off by default. It relies on [WorkManager](https://developer.android.com/topic/libraries/architecture/workmanager)
to upload its results, because a system trace or heap dump can be large (often over 10 MB) and must be uploaded durably
in the background. 

To avoid pulling WorkManager and its transitive dependencies into apps that don't need profiling,
Measure does not bundle it. Profiling is enabled only when WorkManager is present as a dependency.

To enable profiling, add the WorkManager dependency to your app's `build.gradle.kts` (use the latest available version):

```kotlin
dependencies {
    implementation("androidx.work:work-runtime:2.10.0")
}
```

When WorkManager is not present, the profiling collector is never registered and no profiling data is collected.

## Triggers

A trigger describes an occasion on which the operating system may capture a profile. Measure currently registers two.

> [!NOTE]  
> Android 17 (API level 37) adds further profiling triggers, such as out-of-memory, cold start and excessive CPU usage.
> Registering these requires compiling against the Android 17 SDK (`compileSdk 37`); support is coming soon.

### App fully drawn (`app_launch`)

Captured once the app reports that it has finished drawing its first meaningful content. This is not automatic: your app
must signal the moment by calling [`Activity.reportFullyDrawn()`](https://developer.android.com/reference/android/app/Activity#reportFullyDrawn()).
Call it once the first screen's meaningful content is on screen, including any data loaded asynchronously:

```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel.loadHome()
    }

    // Call once the first meaningful content has finished rendering.
    private fun onHomeContentReady() {
        reportFullyDrawn()
    }
}
```

### ANR (`anr`)

Captured when the app becomes unresponsive (an Application Not Responding event). The operating system detects ANRs on its own, so no app-side setup is required.

Each trigger is rate-limited by the operating system. Measure sets a rate-limiting period of one hour per trigger type, so the same trigger will not produce more than one profile per hour.

## Sampling

Profiling results are sampled independently of session sampling. The sampling rate is a value between 0 and 100 and
defaults to 100, meaning every result the operating system produces is collected. The default is kept high because the
OS already rate-limits how often each trigger can fire, so an aggressive client-side rate would collect almost nothing. So keep this sampling rate higher than other sampling rates you may have configured.

## How It Works

Measure uses [`android.os.ProfilingManager`](https://developer.android.com/reference/android/os/ProfilingManager), the
platform's trigger-based profiling API introduced in Android 16. The SDK registers the triggers above with the operating
system along with a callback to receive results. From then on the OS decides when to run a profiling
session, writes the result to a file and hands it back. Measure attaches that file to a `profile` event tagged with the trigger that produced it.

Because profiling artifacts can be large, they are uploaded in the background by a dedicated WorkManager worker once the device is connected to a network, rather than in-process with other events. Once uploaded, a result can be downloaded from the session timeline in the dashboard.

## Further reading

* [Android ProfilingManager](https://developer.android.com/reference/android/os/ProfilingManager)
* [Android ProfilingTrigger](https://developer.android.com/reference/android/os/ProfilingTrigger)
* [Perfetto](https://perfetto.dev/)
