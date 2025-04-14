import 'dart:async';

import 'package:flutter/material.dart';
import 'package:measure_flutter/attribute_builder.dart';
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
              final attrs = AttributeBuilder()
                ..add("is_premium", true)
                ..add("integer", 1)
                ..add("string", "string");
              Measure.instance.trackEvent(
                name: "custom-event",
                attributes: attrs.build(),
              );
            },
          ),
        ),
      ),
    );
  }
}
