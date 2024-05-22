# Feature - ANR Tracking

ANRs can occur due
to [various reasons](https://developer.android.com/topic/performance/anrs/diagnose-and-fix-anrs#input-dispatch-common-causes).
Measure tracks ANRs in your app automatically, no additional code is required
to enable this feature.

## How it works

Measure SDK detects ANRs by monitoring the `SIGQUIT` signal using the `measure-ndk`. Checkout the
details of how this works in depth in the [measure-ndk README](/measure-ndk/README.md).

## Data collected

Checkout the data collected by Measure for each ANR in the [ANR Event](../../../docs/api/sdk/README.md#anr) section.
