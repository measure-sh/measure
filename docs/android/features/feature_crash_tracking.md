# Feature - Crash Tracking

Crashes happen in JVM when an exception is thrown and not caught. Measure tracks all unhandled exceptions automatically,
no additional code is required to enable this feature.

A screenshot of the app, as soon as it crashes, is also captured and sent to the server.
See more details about screenshots in the [Screenshot](feature_screenshot.md) section.

## How it works

When an unhandled exception occurs, it is intercepted by Measure using an `UncaughtExceptionHandler`. The stack trace
of the exception is then sent to the Measure server. The server processes the stack trace and groups similar exceptions
together. This helps in identifying the most common exceptions in an app.

In case the stack trace is obfuscated using ProGuard or R8, Measure automatically
de-obfuscates it and shows the original class and method names. Read more details about the
symbolication process [here](symbolication.md).

## Data collected

Checkout the data collected by Measure for each crash in
the [Exception Event](../../api/sdk/README.md#exception) section.

> [!NOTE]  
> Measure only supports crash tracking for Java/Kotlin code. Support for native crashes will be added soon, 
> track the progress [here](https://github.com/measure-sh/measure/issues/103).