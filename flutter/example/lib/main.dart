import 'dart:async';

import 'package:flutter/material.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter_example/src/screen_main.dart';

Future<void> main() async {
  await Measure.instance.init(
        () => runApp(MeasureWidget(child: MyApp())),
    config: const MeasureConfig(
      enableLogging: true,
      autoStart: true,
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
    Measure.instance.startSpan("AppLaunch")
        .setAttributeString("key", "value")
        .end();
    super.initState();
  }

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
