# Upgrading to iOS SDK v0.9.0

## Breaking Changes

#### **Changes to MeasureConfig** 

https://github.com/measure-sh/measure/pull/3077

The following properties from `MeasureConfig` have been removed and can be controlled directly from the dashboard from "Settings -> Apps -> Data Control"

- `trackScreenshotOnCrash`
- `screenshotMaskLevel`
- `trackHttpBody`
- `httpHeadersBlocklist`
- `httpUrlBlocklist`
- `httpUrlAllowlist`
- `traceSamplingRate`
- `coldLaunchSamplingRate`
- `warmLaunchSamplingRate`
- `hotLaunchSamplingRate`
- `journeySamplingRate`

`trackHttpHeaders` is completely removed. To control the tracking of HTTP headers, you can use the dashboard to
enable/disable request or response body tracking which also controls the tracking of HTTP headers.

`samplingRateForErrorFreeSessions` has been removed. A new flag called `enableFullCollectionMode` has been added
to `MeasureConfig` which when enabled, will collect all events and spans by ignoring all sampling rates set on the
dashboard. This can be used if you want to collect all events without sampling. Typically useful in debug builds.

For more details, checkout the [configuration options](../features/configuration-options.md) documentation.

## Behavior Changes

####  **Improved Span validation** 

https://github.com/measure-sh/measure/pull/3077

Span name and attribute validations have been made stricter in accordance to the limits mentioned in the
[documentation](../features/feature-performance-tracing.md#limits). If a span name exceeds the maximum allowed length, it
will be discarded. While, if an attribute key name exceeds the maximum allowed length, the attribute will be discarded.

A log message will be printed in both cases to help identify the issue during development. Earlier these would get
discarded silently on the server with no feedback during development.

#### **Session timeline duration** 

https://github.com/measure-sh/measure/pull/3077

For older versions, the SDK would report all events for a session when a crash, ANR or bug report was encountered. For
very long sessions, this led to a lot of unnecessary events being reported which made it harder to get to the root cause.

With this release, the SDK will only report events that occurred within a certain time window before the crash, ANR or
bug report. This time window is configurable from the dashboard and can be set to a value can be configured in seconds
to a max of 3600 seconds (1 hour). The default value is 300 seconds (5 minutes).
