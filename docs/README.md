# Documentation

## Table of Contents

* [**Integrate the SDK**](#integrate-the-sdk) — Set up measure-sh SDK in your mobile app
* [**Explore Features**](#explore-features) — Explore all available features
* [**Configuration Options**](#configuration-options) — Customize SDK behavior
* [**Control costs**](#cost-control) — Techniques to control data collection and storage costs
* [**Performance impact**](#performance-impact) — Measure the SDK's impact on app performance

## Further Reading

* [**Self Hosting Guide**](hosting/README.md) - Host Measure on your own
* [**API Documentation**](api/README.md) - APIs that various Measure SDKs use
* [**Versioning Guide**](versioning/README.md) - Understand how versions are tagged
* [**Contribution Guide**](CONTRIBUTING.md) - Contribute to Measure

_______

# Integrate the SDK

Check out the [SDK integration guide](sdk-integration-guide.md) to learn how to set up measure-sh for your app. Then
refer to the documentation below for details on features and how to make the best use of measure-sh for your app.

# Explore Features

The following pages include instructions, configuration options, to help you understand how to leverage different
features in your mobile applications. Also review the 'How It Works' section in each feature's documentation to
understand its underlying mechanism and enhance your ability to use it effectively.

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
* [**Identify users**](features/feature-identify-users.md) — Correlate sessions with a user ID
* [**Manually start or stop the SDK**](features/feature-manually-start-stop-sdk.md) — Control when data collection
  happens

# Configuration options

Each feature section above contains the configuration options available for that feature. These options allow you to
customize the behavior of the SDK to suit your application's needs. You can also find a comprehensive list of all
configuration options in the [configuration options](features/configuration-options.md) documentation.

# Cost control

To control costs, measure-sh provides sampling options to limit the amount of data collected and the time for which
it is retained on the server. This helps balance data quality with storage costs. Read the following pages for more
information.

* [Sampling](features/feature-sampling.md)
* [Data Retention](features/feature-data-retention.md)

# Performance Impact

Read [performance impact](features/performance-impact.md) for details on how adding measure-sh impacts your app and how
to benchmark it for your application.