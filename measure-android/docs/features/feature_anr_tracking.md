# Feature - ANR Tracking

ANRs can occur due
to [various reasons](https://developer.android.com/topic/performance/anrs/diagnose-and-fix-anrs#input-dispatch-common-causes).
Measure tracks ANRs in your app automatically, no additional code is required
to enable this feature.

## How it works

Measure uses the
popular [ANR Watchdog](https://github.com/measure-sh/measure/blob/main/measure-android/measure/src/main/java/sh/measure/android/anr/ANRWatchDog.kt)
approach to detect ANRs. The ANR Watchdog uses a thread which posts a runnable to the main thread every 5 seconds.
If the runnable is not executed within 5 seconds, it means the main thread is blocked. We also check
the [ActivityManager.getProcessesInErrorState]() to ensure the application is in "not responding" state before recording
the ANR to reduce false positives. The stack trace of all the threads, including main thread, is then sent to the
Measure server.

In case the stack trace is obfuscated using ProGuard or R8, Measure automatically
de-obfuscates it and shows the original class and method names. Read more details about the
symbolication process [here](../features/symbolication.md).

## Data collected

Checkout the data collected by Measure for each ANR in the [ANR Event](../../../docs/api/sdk/README.md#anr) section.
