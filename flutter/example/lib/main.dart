import 'dart:async';

import 'package:flutter/material.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter_example/src/msr/msr_widgets.g.dart';
import 'package:measure_flutter_example/src/screen_main.dart';


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
      layoutSnapshotWidgetTypes: msrWidgetsForLayoutSnapshot,
    ),
    clientInfo: ClientInfo(
      apiKey: "msrsh_0c89033fc9ca86c29ba0300452d65ee441a60aac5adc7c5ee2d5057ebcbb4133_2d215ff0",
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
