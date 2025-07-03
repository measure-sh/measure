# Manually Start and Stop the SDK

By default, initializing the SDK starts collection of events. To delay start to a different point in your app
set `autoStart` to `false` during initialization. This can be used to control the scope of where the SDK is active in
your application.

> [!IMPORTANT]
> Some SDK instrumentation remains active even when stopped. This is to maintain state and ensure seamless data
> collection when it is started.
> Additionally, cold, warm & hot launch events are also always captured. However, no data is sent to the server until
> the SDK is started.

### Android

```kotlin
Measure.init(
    context, MeasureConfig(
        // delay starting of collection
        autoStart = false,
    )
)

// Start collecting
Measure.start()

// Stop collecting
Measure.stop()
```

### iOS

```swift
let config = BaseMeasureConfig(autoStart: false) // delay starting of collection
let clientInfo = ClientInfo(apiKey: "<apiKey>", apiUrl: "<apiUrl>")
Measure.initialize(with: clientInfo, config: config)

// Start collecting
Measure.start()

// Stop collecting
Measure.stop()
```

### Flutter

```dart
Future<void> main() async {
  await Measure.instance.init(
        () =>
        runApp(
          MeasureWidget(child: MyApp()),
        ),
    config: const MeasureConfig(
      autoStart: false, // delay starting of collection
    ),
    clientInfo: ClientInfo(
      apiKey: "YOUR_API_KEY",
      apiUrl: "YOUR_API_URL",
    ),
  );
}

// Start collecting
Measure.instance.start();

// Stop collecting
Measure.instance.stop();
```