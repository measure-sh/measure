import 'dart:async';
import 'dart:isolate';

import 'package:flutter/material.dart';
import 'package:measure_flutter/attribute_builder.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter_example/src/list_item.dart';
import 'package:stack_trace/stack_trace.dart';

Future<void> main() async {
  FlutterError.onError = (FlutterErrorDetails details) {
    Measure.instance.trackFlutterError(details.exception, details.stack);
  };

  runZonedGuarded(() async {
    await Measure.instance.init(enableLogging: true);
    runApp(MyApp());
  }, (error, stackTrace) {
    Measure.instance.trackFlutterError(error, stackTrace);
  });
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
          title: const Text('Measure Flutter'),
        ),
        body: ListView(
          children: [
            ListItem(title: "Track custom event", onPressed: _trackCustomEvent),
            ListItem(title: "Throw error", onPressed: _trackError),
            ListItem(
                title: "Error in microtask", onPressed: _trackMicroTaskError),
            ListItem(title: "Error in isolate", onPressed: _trackIsolateError),
            ListItem(title: "Throw exception", onPressed: _throwException),
            ListItem(
              title: "Throw async exception",
              onPressed: _throwAsyncException,
            ),
            ListItem(
              title: "Throw string",
              onPressed: _throwString,
            ),
            ListItem(
              title: "Native crash",
              onPressed: () {
                _throwNativeCrash();
              },
            ),
            ListItem(
              title: "Throw OOM",
              onPressed: () {
                _throwOOM();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _trackCustomEvent() {
    final attrs = AttributeBuilder()
      ..add("is_premium", true)
      ..add("integer", 1)
      ..add("string", "string");
    Measure.instance.trackEvent(
      name: "event",
      attributes: attrs.build(),
    );
  }

  void _throwException() {
    throw FormatException("This is an exception");
  }

  Future<void> _throwAsyncException() async {
    Chain.capture(() async {
      await Future.delayed(const Duration(seconds: 2));
      throw FormatException(
          "This is an exception using Chan.capture from an async block");
    });
  }

  void _trackError() {
    throw ArgumentError("This is an error");
  }

  void _trackMicroTaskError() {
    Future.microtask(() {
      throw FormatException(
          "This is an exception from inside Future.microtask");
    });
  }

  Future<void> _trackIsolateError() async {
    Isolate.run(() {
      throw FormatException("This is an exception from inside Isolate.run");
    });
  }

  void _throwString() {
    throw "are you serious? 😕";
  }

  void _throwNativeCrash() {
    Measure.instance.triggerNativeCrash();
  }

  void _throwOOM() {
    List<int> list = [];
    while (true) {
      list.addAll(List.filled(1024 * 1024, 42));
    }
  }
}
