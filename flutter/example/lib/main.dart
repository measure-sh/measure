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
      apiKey: "msrsh_7c22875ec57832fa068f8f74e8a4663dd38688e462ca9bb5f70e2028ac0d5cd7_4461dc8e",
      apiUrl: "https://humbly-natural-polliwog.ngrok-free.app",
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
