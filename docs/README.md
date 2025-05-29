# Documentation

## Table of Contents

* [**Integrate the SDK**](#getting-started) — Set up measure-sh in your mobile app
* [**Explore Features**](#explore-features) — Explore all available features
* [**Configuration Options**](#configuration-options) — Customize SDK behavior
* [**Identify Users**](#identify-users) — Correlate sessions with a user ID
* [**Manually start/stop the SDK**](#manually-start-or-stop-the-sdk) — Control when data collection happens
* [**Control costs**](#cost-control) — Techniques to control data collection and storage costs
* [**Performance impact**](#performance-impact) — Measure the SDK's impact on app performance

#### Additional Resources

* [**Self Hosting Guide**](hosting/README.md) - Host Measure on your own
* [**API Documentation**](api/README.md) - APIs that various Measure SDKs use
* [**Versioning Guide**](versioning/README.md) - Understand how versions are tagged
* [**Contribution Guide**](CONTRIBUTING.md) - Contribute to Measure
* [**FAQs**](faqs.md) - Explore frequently asked questions

_______

# Integrate the SDK

Check out the [SDK integration guide](sdk-integration-guide.md) to learn how to set up measure-sh for your app. Then
refer to the documentation below for more details on features and how to make the best use of measure-sh for your app.

# Explore Features

For detailed information on each feature, refer to the individual documentation pages linked below. These pages include
setup instructions, configuration options, to help you understand how to leverage measure-sh in your mobile
applications.

Also, look for the "how it works" section in each feature documentation to understand the underlying mechanism of
each feature to become better equipped to use it effectively.

* [**Session Monitoring**](features/feature-session-monitoring.md) — Find and view complete user sessions
* [**Crash reporting**](features/feature-crash-reporting.md) — Analyze app crashes
* [**ANR reporting**](features/feature-anr-reporting.md) — Analyze Application Not Responding (ANR) issues
* [**Performance tracing**](features/feature-performance-tracing.md) — Monitor app performance with traces
* [**Track custom events**](features/feature-track-custom-events.md) — Capture custom events in your app
* [**Bug reports**](features/feature-bug-report.md) — Capture detailed bug reports with screenshots and logs
* [**App launch metrics**](features/feature-app-launch-metrics.md) — Measure app launch performance
* [**Network monitoring**](features/feature-network-monitoring.md) — Monitor HTTP requests and responses
* [**Navigation & lifecycle tracking**](features/feature-navigation-lifecycle-tracking.md) — Track app navigation and
  lifecycle events
* [**CPU monitoring**](features/feature-cpu-monitoring.md) — Monitor CPU usage for every session
* [**Memory monitoring**](features/feature-memory-monitoring.md) — Monitor memory usage for every session
* [**App size monitoring**](features/feature-app-size-monitoring.md) — Monitor app size changes

# Configuration options

Each feature section above contains the configuration options available for that feature. These options allow you to
customize the behavior of the SDK to suit your application's needs. You can also find a comprehensive list of all
configuration options in the [configuration options](features/configuration-options.md) documentation.

# Identify users

Correlating sessions with users is critical for debugging certain issues. Measure allows setting a user ID which can
then be used to query sessions and events on the dashboard. User ID is persisted across app
launches.

> [!IMPORTANT]
>
> It is recommended to **avoid** the use of PII (Personally Identifiable Information) in the
> user ID like email, phone number or any other sensitive information. Instead, use a hashed
> or anonymized user ID to protect user privacy.

### Android

To set a user ID.

```kotlin
Measure.setUserId("user-id")
```

To clear a user ID.

```kotlin
Measure.clearUserId()
```

### iOS

To set a user ID.

```swift
Measure.shared.setUserId("user-id")
```

To clear a user ID.

```swift
Measure.shared.clearUserId()
```

# Manually start or stop the SDK

By default, initializing the SDK starts collection of events. To delay start to a different point in your app
use [configuration options](android/configuration-options.md#autostart). This can be used to control the scope of
where Measure is active in your application.

> [!IMPORTANT]
> Some SDK instrumentation remains active even when stopped. This is to maintain state and ensure seamless data
> collection when it is started.
> Additionally, cold, warm & hot launch events are also always captured. However, no data is sent to the server until
> the SDK is started.

### Android

```kotlin
Measure.init(
    context, MeasureConfig(
        // delay starting of collection
        autoStart = false,
    )
)

// Start collecting
Measure.start()

// Stop collecting
Measure.stop()
```

### iOS

```swift
let config = BaseMeasureConfig(autoStart: false) // delay starting of collection
let clientInfo = ClientInfo(apiKey: "<apiKey>", apiUrl: "<apiUrl>")
Measure.shared.initialize(with: clientInfo, config: config)

// Start collecting
Measure.shared.start()

// Stop collecting
Measure.shared.stop()
```

# Cost control

To control costs, measure-sh provides sampling options to limit the amount of data collected and the time for which
it is retained on the server. This helps balance data quality with storage costs. Read the following pages for more
information.

* [Sampling](features/feature-sampling.md)
* [Data Retention](features/feature-data-retention.md)

# Performance Impact

Read [performance impact](features/performance-impact.md) for details on how adding measure-sh impacts your app and how
to
benchmark it for your application.