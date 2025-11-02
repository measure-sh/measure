import 'dart:async';

import 'package:flutter/material.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter_example/src/screen_main.dart';

import 'msr_widgets.g.dart';

Future<void> main() async {
  await Measure.instance.init(
    () => runApp(MeasureWidget(child: MyApp())),
    config: const MeasureConfig(
      enableLogging: true,
      trackScreenshotOnCrash: true,
      trackHttpHeaders: true,
      trackHttpBody: true,
      httpUrlBlocklist: ['http://localhost'],
      autoStart: true,
      traceSamplingRate: 1,
      samplingRateForErrorFreeSessions: 1,
      widgetFilter: widgetFilter,
    ),
    clientInfo: ClientInfo(
      apiKey: "msrsh_8456989a9cd452c7a4864d37a1f3cf9b4f8a45395203c19cb5b6d8252c6970fd_95a8744f",
      apiUrl: "https://staging-ingest.measure.sh",
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorObservers: [MsrNavigatorObserver()],
      theme: ThemeData(
        brightness: Brightness.light,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.light,
        ),
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.dark,
        ),
      ),
      themeMode: ThemeMode.system,
      home: MainScreen(),
    );
  }
}
