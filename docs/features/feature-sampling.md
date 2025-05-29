# Sampling

Sampling controls what percentage of data is collected and sent to the server, helping balance data quality with system performance and storage costs.

## Session Sampling

Set [samplingRateForErrorFreeSessions](configuration-options.md#samplingrateforerrorfreesessions) to control event collection from sessions without errors. By default, the SDK sends all events from crashed sessions to the server, while collecting no events from error-free sessions.

* 0.0 — No events from error-free sessions (default)
* 0.1 — 10% of error-free sessions
* 1.0 — All sessions

Session sampling helps optimize data collection for crash and error analysis.

## Trace Sampling 

[traceSamplingRate](configuration-options.md#tracesamplingrate) controls performance trace collection independently of session sampling. While session sampling determines which session-level events are sent, trace sampling specifically controls performance monitoring data.

This separation ensures:
- Performance traces are collected based on their own sampling rate.
- Critical performance data is captured regardless of session errors.
- Session data remains focused on crash analysis and debugging.