# Session Monitoring

A session represents a continuous period of activity in the app. A new session begins when an app is launched for the
first time, or when there's been no activity for a 20-minute period. A single session can continue across multiple app
background and foreground events; brief interruptions will not cause a new session to be created.

The current session can be retrieved by using `getSessionId` method.

### Android

```kotlin
val sessionId = Measure.getSessionId()
```

### iOS

Using swift:

```swift
let sessionId = Measure.shared.getSessionId()
```

or, in Objective-C:

```objc
NSString *sessionId = [[Measure shared] getSessionId];
```

## Session Search


## Session Timeline