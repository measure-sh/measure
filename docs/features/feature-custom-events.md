## Track custom events

Custom events provide more context on top of automatically collected events. They provide the context
specific to the app to debug issues and analyze impact.

To track a custom event use `trackEvent` method.

```kotlin
Measure.trackEvent("event_name")
```

A custom event can also contain attributes which are key value paris.

- Attribute keys must be strings with max length of 256 chars.
- Attribute values must be one of the primitive types: int, long, double, float or boolean.
- String attribute values can have a max length of 256 chars.

```kotlin
val attributes = AttributesBuilder()
    .put("is_premium_user", true)
    .build()
Measure.trackEvent("event_name", attributes = attributes)
```

A custom event can also be triggered with a timestamp to allow tracking events which might
have happened before the app or SDK was initialized. The timestamp must be in format milliseconds
since epoch.

```kotlin
Measure.trackEvent("event_name", timestamp = 1734443973879L)
```