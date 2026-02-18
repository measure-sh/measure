# Upgrading to Measure Flutter SDK v0.4.0

## Breaking Changes

#### **Changes to MeasureConfig**

https://github.com/measure-sh/measure/pull/3090

The following properties from `MeasureConfig` have been removed and can be controlled directly from the dashboard from "Settings -> Apps -> Data Control"

- `trackScreenshotOnCrash`
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

`autoInitializeNativeSDK` has been removed. The native iOS and Android SDKs **must** be initialized manually. Read more
about it in the [SDK initialization guide](../sdk-integration-guide.md) documentation.

For more details, checkout the [configuration options](../features/configuration-options.md) documentation.

## Behavior Changes

#### **Session timeline duration**

https://github.com/measure-sh/measure/pull/3090

For older versions, the SDK would report all events for a session when a crash, ANR or bug report was encountered. For
very long sessions, this led to a lot of unnecessary events being reported which made it harder to get to the root cause.

With this release, the SDK will only report events that occurred within a certain time window before the crash, ANR or
bug report. This time window is configurable from the dashboard and can be set to a value can be configured in seconds
to a max of 3600 seconds (1 hour). The default value is 300 seconds (5 minutes).

#### **Layout Snapshots**

https://github.com/measure-sh/measure/pull/2751

[Layout Snapshots](../features/feature-gesture-tracking.md#layout-snapshots-1) are now available for Flutter along with
a new `measure_build` package that can be used to enhance the layout snapshots with widgets declared in your
app. To learn more checkout the `measure_build` package [documentation](../../flutter/packages/measure_build/README.md).
