# Track errors

Measure automatically captures crashes and ANRs (Application Not Responding) in your app, but you can also track handled
exceptions that occur during normal app operation. This is useful for identifying issues that may not crash the app but
still affect user experience.

- [**API Reference**](#api-reference)

## API Reference

#### Android

To track handled exceptions, use the `trackHandledException`method.

```kotlin
try {
    methodThatThrows()
} catch (e: Exception) {
    Measure.trackHandledException(e)
}
```

#### iOS

This feature is currently not implemented on iOS.
