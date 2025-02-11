import 'dart:async';

import 'package:flutter/material.dart';
import 'package:measure_flutter/measure.dart';

Future<void> main() async {
  await Measure.instance.init(enableLogging: true);
  runApp(const MyApp());
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
      home: Scaffold(
        appBar: AppBar(
          title: const Text('Plugin example app'),
        ),
        body: Center(
          child: Text("Hello world!"),
        ),
      ),
    );
  }
}
