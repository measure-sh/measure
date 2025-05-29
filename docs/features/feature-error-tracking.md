### Track errors

To track exceptions which were caught and handled by the app, use the `trackHandledException`
method. While your app gracefully recovers from these exceptions, tracking them helps identify potential degraded app
experience.

```kotlin
try {
    methodThatThrows()
} catch (e: Exception) {
    Measure.trackHandledException(e)
}
```
