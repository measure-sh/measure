import 'dart:async';

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
    ),
  );
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorObservers: [MsrNavigatorObserver()],
      home: MainScreen(),
    );
  }
}
