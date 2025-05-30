# Track custom events

* [**Introduction**](#introduction)
* [**Custom events in session search**](#custom-events-in-session-search)
* [**Custom events in session timeline**](#custom-events-in-session-timeline)
* [**API Reference**](#api-reference)
    * [**Track a custom event**](#track-a-custom-event)
    * [**Custom event attributes**](#custom-event-attributes)
    * [**Custom event with timestamp**](#custom-event-with-timestamp)

## Introduction

Custom events let you add your own context on top of the automatically collected events. They’re great for tracking
things that matter to your app, like user actions, feature usage, feature flags, or any other domain-specific data. This
helps you debug issues more effectively and analyze the real-world impact of your features.

> [!TIP]
>
> Some events like Screen View, Swift UI Lifecycle, View Controller Lifecycle, Handled errors/exceptions, and HTTP can
> be tracked using dedicated methods. This allows you to maintain a consistent structure for common events which is
> easier to search and analyze.

## Custom events in session search

You can search for session by custom events and their attributes. This allows you to filter sessions based on domain
specific data. For example, you can search for sessions where a specific feature was used, or where a particular user
property was set.

For example, if you have a `login_success` event along with an attribute `has_subscribed` that indicates whether the
user has subscribed to a premium plan, you can search for sessions with this attribute.

## Custom events in session timeline

Custom events are included in [session timeline](feature-session-monitoring.md#session-timeline) along with other
automatically collected events. The event and it's attributes can be viewed in the timeline, making it easy to
get context on what happened during a session.

## API Reference

### Track a custom event

To track a custom event use `trackEvent` method.

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

### Custom event attributes

A custom event can also contain attributes which are key value paris.

> [!NOTE]
> - Attribute keys must be strings with max length of `256` chars.
> - Attribute values must be one of the primitive types: `int`, `long`, `double`, `float` or `boolean`.
> - String attribute values can have a max length of `256` chars.

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

### Custom event with timestamp

You can also record a custom event with a specific timestamp. This is useful for tracking events that happened before
the SDK was initialized, like events during app startup. The timestamp should be in milliseconds since epoch.

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

