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

To track handled errors or exceptions, use the `trackError` method with either a native Swift Error or an NSError.

```swift
do {
    try someThrowingFunction()
} catch {
    Measure.trackError(error)
}
```

You can optionally include metadata and enable stack trace collection.

```swift
Measure.trackError(error, attributes: [
    "screen": .string("Login"),
    "retryCount": .int(2)
], collectStackTraces: true)
```

You can track handled NSError objects from Objective-C code as well using `trackError` method.

```objc
[Measure trackError:error attributes:@{ @"screen": @"Login", @"retryCount": 2 } collectStackTraces:YES];
```
