# Identify users

Correlating sessions with users is critical for debugging certain issues. You can set a user ID which can then be used
to query sessions on the dashboard. 

Note that the User ID is persisted across app launches automatically.

> [!IMPORTANT]
>
> It is recommended to **avoid** the use of PII (Personally Identifiable Information) in the
> user ID like email, phone number or any other sensitive information. Instead, use a hashed
> or anonymized user ID to protect user privacy.

### Android

To set a user ID.

```kotlin
Measure.setUserId("user-id")
```

To clear a user ID.

```kotlin
Measure.clearUserId()
```

### iOS

To set a user ID.

```swift
Measure.shared.setUserId("user-id")
```

To clear a user ID.

```swift
Measure.shared.clearUserId()
```
