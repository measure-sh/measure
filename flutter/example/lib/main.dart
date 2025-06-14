import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter_example/src/screen_main.dart';

Future<void> main() async {
  await Measure.instance.start(
    () => runApp(MyApp()),
    config: const MeasureConfig(
      enableLogging: true,
      trackHttpHeaders: true,
      trackHttpBody: true,
      httpUrlBlocklist: ['http://localhost'],
    ),
    clientInfo: ClientInfo(
      apiKey: _getApiKey(kReleaseMode),
      apiUrl: "https://localhost:8080",
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorObservers: [MsrNavigatorObserver()],
      home: MainScreen(),
    );
  }
}

String _getApiKey(bool releaseMode) {
  if (releaseMode) {
    return "your-api-key";
  } else {
    return "your-api-key";
  }
}
