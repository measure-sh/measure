# Sampling

Sampling controls what percentage of data is collected and sent to the server, helping balance data quality with system performance and storage costs.

There are two sampling configurations available: one to control sessions and another to control performance traces. These configurations allow you to fine-tune data collection based on your app's needs.

* [**Session Sampling**](#session-sampling)
* [**Performance Traces Sampling**](#performance-traces-sampling)

## Session Sampling

By default, all [sessions](feature-session-monitoring.md#what-is-a-session) with a crash or bug report are collected and sent to the server. If a session does not have any crashes or bug reports, no data is sent for that session. This default behavior helps reduce unnecessary data storage and processing costs while still capturing critical information from sessions that do encounter issues.

This sampling rate can be configured during SDK initialization using `samplingRateForErrorFreeSessions`. By default, this is set to `0`.

To randomly select a percentage of sessions without crashes or bug reports to be sent to the server, set the `samplingRateForErrorFreeSessions` to a value between `0.0` and `1.0`. For example:

* `0.0` — No events from error-free sessions (default)
* `0.1` — 10% of error-free sessions
* `1.0` — All sessions

> [!IMPORTANT]
>
> App launch metrics & lifecycle events are collected for all sessions, regardless of the sampling rate set. This is to
> ensure the critical performance metrics like adoption, crash-free rate, user journey, and app launch performance are
> always available.

## Performance Traces Sampling

By default, performance traces are collected at a sampling rate of `0.1`. This means that 10% of all performance traces are sent to the server.

Use `traceSamplingRate` to randomly select a percentage of performance traces to be sent to the server. For example:
* `0.0` — No performance traces are sent to the server
* `0.1` — 10% of performance traces are sent to the server
* `1.0` — All performance traces are sent to the server
