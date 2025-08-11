# Track errors

Measure automatically captures crashes and ANRs (Application Not Responding) in your app, but you can also track handled
exceptions that occur during normal app operation. This is useful for identifying issues that may not crash the app but
still affect user experience.

- [**API Reference**](#api-reference)
  - [**Android**](#android)
  - [**iOS**](#ios)
  - [**Flutter**](#flutter)

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

From version `0.12.0` onwards you can also add attributes to the tracked exception, which can be useful for
providing additional context about the error.

- Attribute keys must be strings with a maximum length of 256 characters.
- Attribute values must be one of the primitive types: `int`, `long`, `double`, `float`, or `boolean`.
- String attribute values can have a maximum length of 256 characters.

```kotlin
try {
    methodThatThrows()
} catch (e: Exception) {
    val attributes = AttributesBuilder().put("screen", "Login")
        .put("retryCount", 2)
        .build()
    Measure.trackHandledException(e, attributes)
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

You can optionally include attributes and enable stack trace collection.

- Attribute keys must be strings with a maximum length of 256 characters.
- Attribute values must be one of the primitive types: `int`, `long`, `double`, `float`, or `boolean`.
- String attribute values can have a maximum length of 256 characters.

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

#### Flutter

To track handled exceptions in Flutter, use the `trackHandledError` method from the Measure SDK.

```dart
try {
  methodThatThrows();
} catch (e, stackTrace) {
  Measure.trackHandledError(e, stackTrace);
}
```