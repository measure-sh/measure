# Documentation

### Table of Contents

* [**Integrate the SDK**](#integrate-the-sdk) — Set up the measure-sh SDK in your mobile app
* [**Explore Features**](#explore-features) — Discover all available features
* [**Configuration Options**](#configuration-options) — Customize SDK behavior
* [**Data Control**](#data-control) — Techniques to manage data collection and storage costs
* [**Performance Impact**](#performance-impact) — Assess the SDK's impact on app performance

**Further Reading**

* [**Self-Hosting Guide**](hosting/README.md) - Host measure-sh on your own
* [**API Documentation**](api/README.md) - APIs that various Measure SDKs use
* [**Versioning Guide**](versioning/README.md) - Understand how versions are tagged
* [**Contribution Guide**](CONTRIBUTING.md) - Contribute to Measure

# Integrate the SDK

Check out the [SDK Integration Guide](sdk-integration-guide.md) to learn how to set up measure-sh for your app. Then
refer to the documentation below for details on features and how to make the best use of measure-sh for your app.

# Explore Features

Explore the following pages which include instructions and configuration options to help you understand
how to leverage different features in your mobile applications. Also, review the 'How It Works' section in each
feature's documentation to understand its underlying mechanism and enhance your ability to use it effectively.

* [**Session Timelines**](features/feature-session-timelines.md) — Find and view session timelines
* [**Crash Reporting**](features/feature-crash-reporting.md) — Analyze app crashes
* [**ANR Reporting**](features/feature-anr-reporting.md) — Analyze Application Not Responding (ANR) issues
* [**Error Tracking**](features/feature-error-tracking.md) — Track and analyze handled errors in your app
* [**Gesture Tracking**](features/feature-gesture-tracking.md) — Automatically track user gestures in your app
* [**Performance Tracing**](features/feature-performance-tracing.md) — Monitor app performance with traces
* [**Custom Events**](features/feature-custom-events.md) — Capture custom events in your app
* **Bug Reporting** — Let users report bugs directly from your app
    * [**Android**](features/feature-bug-report-android.md)
    * [**iOS**](features/feature-bug-report-ios.md)
    * [**Flutter**](features/feature-bug-report-flutter.md)
* [**App Launch Metrics**](features/feature-app-launch-metrics.md) — Measure app launch performance
* [**Network Monitoring**](features/feature-network-monitoring.md) — Monitor HTTP requests and responses
* [**Network Connectivity Changes**](features/feature-network-connectivity-changes.md) — Track when network connectivity changes
* [**Navigation & Lifecycle Tracking**](features/feature-navigation-lifecycle-tracking.md) — Track app navigation and
  lifecycle events
* [**CPU Monitoring**](features/feature-cpu-monitoring.md) — Monitor CPU usage for every session
* [**Memory Monitoring**](features/feature-memory-monitoring.md) — Monitor memory usage for every session
* [**Identify Users**](features/feature-identify-users.md) — Correlate sessions with a user ID
* [**Manually Start or Stop the SDK**](features/feature-manually-start-stop-sdk.md) — Control when data collection
  happens
* [**App Size Monitoring**](features/feature-app-size-monitoring.md) — Monitor app size changes
* [**Alert Notifications**](features/feature-alerts.md) — Receive Crash & ANR spike alerts and Daily Summaries for core app metrics.

# Configuration Options

Measure provides a number of configuration options to customize data collection and SDK behavior. These options are
available in two ways:

* **SDK Options** — Set at initialization time in your app's code.
* **Remote Configuration Options** — Configured remotely from the Measure dashboard. Changes take effect without releasing a new
  app version.

Read more about [Configuration Options](#configuration-options).

# Data Retention

To limit the time for which data is retained on the server. This helps balance data quality with storage costs. Read 
the following pages for more information [Data Retention](features/feature-data-retention.md).

# Performance Impact

Read the [Performance Impact](features/performance-impact.md) documentation to understand how the SDK affects your app's
performance and how to measure it.