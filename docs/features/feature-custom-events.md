# Track Custom Events

* [**Introduction**](#introduction)
* [**Custom Events in Session Timeline**](#custom-events-in-session-timeline)
* [**API Reference**](#api-reference)
    * [**Track a Custom Event**](#track-a-custom-event)
    * [**Custom Event Attributes**](#custom-event-attributes)
    * [**Custom Event with Timestamp**](#custom-event-with-timestamp)

## Introduction

Custom events let you add your own context on top of the automatically collected events. They’re great for tracking things that matter to your app, like user actions, feature usage, feature flags, or any other domain-specific data. This helps you debug issues more effectively and analyze the real-world impact of your features.

> [!TIP]
>
> Some events like Screen View and Handled errors/exceptions can be tracked using dedicated methods. This allows you to maintain a consistent structure for common events, making them easier to search and analyze.

## Custom Events in Session Timeline

Custom events are included in the [Session Timeline](feature-session-monitoring.md#session-timeline) along with other automatically collected events. The event and its attributes can be viewed in the timeline, making it easy to get context on what happened during a session.

## API Reference

### Track a Custom Event

To track a custom event, use the `trackEvent` method.

#### Android

```kotlin
Measure.trackEvent("event_name")
```

#### iOS

Using Swift:

```swift
Measure.shared.trackEvent(name: "event_name")
```

Using ObjC:

```objc
[[Measure shared] trackEvent:@"event_name"];
```

### Custom Event Attributes

A custom event can also contain attributes, which are key-value pairs.

> [!NOTE]
> - Attribute keys must be strings with a maximum length of `256` characters.
> - Attribute values must be one of the primitive types: `int`, `long`, `double`, `float`, or `boolean`.
> - String attribute values can have a maximum length of `256` characters.

#### Android

```kotlin
val attributes = AttributesBuilder()
    .put("is_premium_user", true)
    .build()
Measure.trackEvent("event_name", attributes = attributes)
```

#### iOS

Using Swift:

```swift
Measure.shared.trackEvent(name: "event_name", attributes: ["is_premium_user": .bool(true)])
```

Using ObjC:

```objc
[[Measure shared] trackEvent:@"event_name" attributes:@{@"is_premium_user": YES}];
```

### Custom Event with Timestamp

You can also record a custom event with a specific timestamp. This is useful for tracking events that happened before the SDK was initialized, like events during app startup. The timestamp should be in milliseconds since epoch.

#### Android

```kotlin
Measure.trackEvent("event_name", timestamp = 1734443973879L)
```

#### iOS

Using Swift:

```swift
Measure.shared.trackEvent(name: "event_name", timestamp: 1734443973879)
```

Using ObjC:

```objc
[[Measure shared] trackEvent:@"event_name" timestamp:1734443973879];
```
