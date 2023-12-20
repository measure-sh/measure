# Introduction

We know first hand that building great mobile applications is hard. Understanding how they are
performing in production
is even harder. We, at Measure, are building a tool we wish existed when we were building and
monitoring mobile apps. We
are excited to share our progress with you, and we hope you will join us on this journey.

Measure Android SDK automatically instruments your app to capture logs and metrics that help you
answer questions about your app in production.

# Getting Started

## Minimum Requirements

| Name                  | Version           |
|-----------------------|-------------------|
| Android Gradle Plugin | TODO              |
| Gradle                | TODO              |
| Java                  | 8                 |
| Kotlin                | 1.3.72            |
| Android               | API 21 (Lollipop) |

## Integration

### 1. Create a Measure account

[//]: # (TODO: Replace with a link to the signup page)
If you haven't already, [create a Measure account](https://measure.sh/signup) and follow the
instructions on the website to create your first app.

[//]: # (TODO: Add screenshots for creating an app)

### 2. Add the API Key

Add the API Key to your app's `AndroidManifest.xml` file.

```xml

<meta-data android:name="measure_api_key" android:value="YOUR_API_KEY" />
```

It is recommended to pass the API Key as an environment variable. This will prevent the API Key from
being checked into source control. If the API key is not provided in the manifest, Measure tries to
read it from `MEASURE_API_KEY` environment variable. If the environment variable is not set, Measure
SDK is not initialized.

### 3. Add Measure SDK to your project

Add the following to your app's `build.gradle`file.

[//]: # (TODO: Replace with the actual version on maven central)

```groovy
implementation 'sh.measure.android:measure:0.0.1'
```

```kotlin
implementation("sh.measure.android:measure:0.0.1")
```

### 4. Monitor Network Requests (optional)

Add the `MeasureEventListenerFactory` to all `OkHttpClient` instances in your app to monitor network
requests.

```kotlin
import sh.measure.android.okhttp.MeasureEventListenerFactory

val client = OkHttpClient.Builder()
    .eventListenerFactory(MeasureEventListenerFactory())
    .build()
```

### 5. Report a session

Launch the app on any device or emulator. Kill and reopen. You should see a new session in the
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