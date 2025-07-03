import 'dart:async';

import 'package:flutter/material.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter_example/src/screen_main.dart';

Future<void> main() async {
  await Measure.instance.init(
        () => runApp(MeasureWidget(child: MyApp())),
    config: const MeasureConfig(
      enableLogging: true,
      trackHttpHeaders: true,
      trackHttpBody: true,
      httpUrlBlocklist: ['http://localhost'],
      autoStart: true,
      traceSamplingRate: 1,
      samplingRateForErrorFreeSessions: 1,
    ),
    clientInfo: ClientInfo(
      apiKey: "msrsh-123",
      apiUrl: "http://localhost:8080",
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