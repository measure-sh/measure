import 'dart:async';

import 'package:flutter/material.dart';
import 'package:measure_flutter/attribute_value.dart';
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
          child: ElevatedButton(
            child: Text("Hello world!"),
            onPressed: () {
              Measure.instance.trackEvent(name: "event", attributes: {
                "is_premium": BooleanAttr(true),
                "integer": IntAttr(1),
                "string": StringAttr("string"),
              });
            },
          ),
        ),
      ),
    );
  }
}
