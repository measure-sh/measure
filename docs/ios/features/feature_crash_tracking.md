# Feature - Crash Tracking

Measure tracks all crashes automatically, no additional code is required to enable this feature.

## How it works

We rely on [PLCrashReporter](https://github.com/microsoft/plcrashreporter) to detect crashes. Once a crash is detected, most recent [attribute](../../api/sdk/README.md#attributes) is saved with the crash report. On next launch, this crash report along with all the events in the previous session are exported to the server.

## Data collected

Checkout the data collected by Measure for each crash in
the [Exception Event](../../api/sdk/README.md#exception) section.
