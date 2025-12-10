# Flutter SDK for measure.sh

Measure is an open source tool to monitor mobile apps, this package contains the Flutter SDK
which helps instrumenting your app easily.

Some features include:

- Capture Crashes and ANRs automatically
- Monitor app health metrics such as launch times, crash rates and app sizes
- Get screenshots with exception reports
- View full event timelines of sessions with auto-tracked user clicks, navigation events, http
  calls, cpu usage, memory usage and more for deeper context
- Collect bug reports directly from users and manage them on the dashboard
- Optimize performance with traces
- Track custom events with additional business specific attributes
- Self hosted and private. Your data stays in your servers

## Integration

### Install the SDK

Add the following dependency to your `pubspec.yaml` file:

```yaml
dependencies:
  measure_flutter: ^0.3.1
```

### Initialize the SDK

To initialize the SDK, you need to call the `Measure.instance.init` method in your `main` function
and wrap your application with `MeasureWidget` as the parent.

```dart
Future<void> main() async {
  await Measure.instance.init(
        () =>
        runApp(
          MeasureWidget(child: MyApp()),
        ),
    config: const MeasureConfig(
      enableLogging: true,
      traceSamplingRate: 1,
      samplingRateForErrorFreeSessions: 1,
    ),
    clientInfo: ClientInfo(
      apiKey: "YOUR_API_KEY",
      apiUrl: "YOUR_API_URL",
    ),
  );
}
```

### Verify Installation

Launch the app with the SDK integrated and navigate through a few screens. The data is sent to the server periodically,
so it may take a few seconds to appear. Checkout the `Usage` section in the dashboard or navigate to the `Sessions` tab
to see the sessions being tracked.


## Track screen views

To hook up with the Flutter navigation system, use the `MsrNavigatorObserver` which automatically
tracks screen views when navigating between screens. You can add it to your `MaterialApp` or
`CupertinoApp` as follows:

```dart
@override
Widget build(BuildContext context) {
  return MaterialApp(
    navigatorObservers: [MsrNavigatorObserver()],
    home: HomeScreen(),
  );
}
```

To manually track screen views in a Flutter application, you can use the `trackScreenView` method:

```dart
Measure.instance.trackScreenView("Home");
```

## Track http events

Network requests made using the Dio package can be tracked by adding the `measure_dio` package to your
project. This package provides `MsrInterceptor` that can automatically track network requests done
using Dio.

```dart
final dio = Dio();
dio.interceptors.add(MsrInterceptor());
```

For any other HTTP client libraries, you can manually track network requests using the
`Measure.instance.trackHttpEvent` method.

# Checkout detailed documentation

Checkout our [documentation](https://github.com/measure-sh/measure/tree/main/docs) to learn more
about Measure.