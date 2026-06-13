---
description: "Track logs with severity levels and view them on the Session Timeline. Logs written by the app are collected automatically."
---

# Logs

* [**Introduction**](#introduction)
* [**Logs in Session Timeline**](#logs-in-session-timeline)
* [**Automatic Log Collection**](#automatic-log-collection)
* [**Minimum Log Level**](#minimum-log-level)
* [**Collecting Logs on iOS**](#collecting-logs-on-ios)
* [**API Reference**](#api-reference)
    * [**Track a Log**](#track-a-log)
    * [**Log Severity**](#log-severity)
    * [**Log Attributes**](#log-attributes)

## Introduction

Logs capture a raw text body with a severity level. They add context around what the app
was doing when an issue occurred, making session timelines easier to debug.

Logs can be tracked manually using the `log` method and are also collected automatically from
the platform's standard log streams.

> [!NOTE]
> Log bodies longer than `4000` characters are truncated.

## Logs in Session Timeline

Logs are included in the [Session Timeline](feature-session-timelines.md) along with other
automatically collected events.

## Automatic Log Collection

Logs written by the app are collected automatically while the SDK is running:

* **Android**: `android.util.Log` calls in app and library code are collected. `Log.v` and
  `Log.d` map to `debug`, `Log.i` to `info`, `Log.w` to `warning`, `Log.e` to `error` and
  `Log.wtf` to `fatal`. Collection is powered by the Measure gradle plugin, which rewrites
  `Log` callsites at build time, so applying the plugin is required. Logs written using NDK
  logging, `System.out` or before the SDK is initialized are not collected.
* **iOS**: logs are not collected automatically. Use the `log` API to track logs, see
  [Collecting Logs on iOS](#collecting-logs-on-ios).
* **Flutter**: Dart `print` output is not collected automatically, use the `log` API to
  track logs from Flutter code. Logs written by native code and plugins are still collected
  by the Android collector described above.
* **React Native**: `console.log`, `console.info`, `console.warn` and `console.error` output
  is collected on both Android and iOS with `info`, `info`, `warning` and `error` severity
  respectively. `console.debug` output is not collected.

## Minimum Log Level

The minimum severity of logs to collect is controlled in the **Logs** section of the SDK
configuration on the Measure dashboard ("Collect logs at _level_ severity and above"). Logs
below the chosen severity are dropped at the source and never leave the device.

It defaults to `info`, meaning `info`, `warning`, `error` and `fatal` logs are collected
while `debug` logs are dropped. Lowering it to `debug` collects everything; raising it to
`error` collects only `error` and `fatal`.

This applies to both automatically collected logs and logs tracked manually with the `log`
API. The SDK fetches configuration on launch, so a changed value takes effect on the next
app launch.

## Collecting Logs on iOS

iOS does not collect logs automatically. Apple's unified logging (`os.Logger`, `os_log` and
`NSLog`) writes to out-of-process system daemons with no public hook to observe it, so the SDK
cannot intercept your existing log statements. Logs must be sent to Measure explicitly using
the [`log`](#track-a-log) API.

To avoid changing every call site, route logging through a single helper that writes to both
your usual log destination and Measure:

```swift
import OSLog
import Measure

enum AppLog {
    private static let logger = Logger(subsystem: "com.example.app", category: "default")

    static func info(_ message: String, attributes: [String: AttributeValue] = [:]) {
        logger.info("\(message, privacy: .public)")
        Measure.log(message, severity: .info, attributes: attributes)
    }

    static func error(_ message: String, attributes: [String: AttributeValue] = [:]) {
        logger.error("\(message, privacy: .public)")
        Measure.log(message, severity: .error, attributes: attributes)
    }
}
```

Then replace `Logger`, `os_log` and `print` calls with `AppLog.info(...)` / `AppLog.error(...)`.

If the app uses [swift-log](https://github.com/apple/swift-log), register a `LogHandler` that
forwards to Measure. This captures every `swift-log` `Logger` in the app and its dependencies,
and only needs to be bootstrapped once at startup:

```swift
import Logging
import Measure

struct MeasureLogHandler: LogHandler {
    var metadata = Logger.Metadata()
    var logLevel: Logger.Level = .info

    subscript(metadataKey key: String) -> Logger.Metadata.Value? {
        get { metadata[key] }
        set { metadata[key] = newValue }
    }

    func log(level: Logger.Level, message: Logger.Message, metadata: Logger.Metadata?,
             source: String, file: String, function: String, line: UInt) {
        Measure.log("\(message)", severity: level.measureSeverity)
    }
}

private extension Logger.Level {
    var measureSeverity: LogSeverity {
        switch self {
        case .trace, .debug: return .debug
        case .info, .notice: return .info
        case .warning: return .warning
        case .error: return .error
        case .critical: return .fatal
        }
    }
}

// Call once, before any logging, e.g. in your App init or AppDelegate.
LoggingSystem.bootstrap { _ in MeasureLogHandler() }
```

## API Reference

### Track a Log

To track a log manually, use the `log` method.

#### Android

```kotlin
Measure.log("Payment failed, retrying")
```

#### iOS

Using Swift:

```swift
Measure.log("Payment failed, retrying")
```

Using ObjC:

```objc
[Measure log:@"Payment failed, retrying" severity:LogSeverityInfo attributes:@{} timestamp:nil];
```

#### Flutter

```dart
Measure.instance.log("Payment failed, retrying");
```

#### React Native

```typescript
Measure.log({ body: 'Payment failed, retrying' });
```

### Log Severity

Logs default to `info` severity. Severity can be one of `debug`, `info`, `warning`, `error`
or `fatal`.

Each severity also carries a numeric `severity_number`: `debug` is `8`, `info` is `12`,
`warning` is `16`, `error` is `20` and `fatal` is `24`. This number is used to evaluate the
[Minimum Log Level](#minimum-log-level) filter.

#### Android

```kotlin
Measure.log("Payment failed, retrying", LogSeverity.Warning)
```

#### iOS

```swift
Measure.log("Payment failed, retrying", severity: .warning)
```

#### Flutter

```dart
Measure.instance.log("Payment failed, retrying", severity: LogSeverity.warning);
```

#### React Native

```typescript
Measure.log({ body: 'Payment failed, retrying', severity: LogSeverity.Warning });
```

### Log Attributes

Logs support the same attributes as custom events, see
[Custom Event Attributes](feature-custom-events.md#custom-event-attributes) for constraints.

#### Android

```kotlin
val attributes = AttributesBuilder()
    .put("retry_count", 3)
    .build()
Measure.log("Payment failed, retrying", LogSeverity.Warning, attributes)
```

#### iOS

```swift
Measure.log("Payment failed, retrying", severity: .warning, attributes: ["retry_count": .int(3)])
```

#### Flutter

```dart
Measure.instance.log(
  "Payment failed, retrying",
  severity: LogSeverity.warning,
  attributes: {"retry_count": IntAttr(3)},
);
```

#### React Native

```typescript
Measure.log({
  body: 'Payment failed, retrying',
  severity: LogSeverity.Warning,
  attributes: { retry_count: 3 },
});
```
