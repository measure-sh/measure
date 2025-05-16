import 'dart:async';
import 'dart:isolate';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:measure_flutter/attribute_builder.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter_example/src/list_item.dart';
import 'package:stack_trace/stack_trace.dart';

Future<void> main() async {
  await Measure.instance.start(() => runApp(MyApp()), enableLogging: true);
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
      home: MainScreen(),
    );
  }
}

class MainScreen extends StatelessWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
            onPressed: _throwNativeCrash,
          ),
          ListItem(
            title: "Throw OOM",
            onPressed: _throwOOM,
          ),
          ListItem(title: "No method channel", onPressed: _noMethodChannel),
          ListItem(
            title: "Text Overflow",
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute<TextOverflowWidget>(
                  builder: (context) => const TextOverflowWidget(),
                ),
              );
            },
          ),
          ListItem(
            title: "Invalid route",
            onPressed: () {
              // This creates a genuine FlutterError that will be caught
              // by FlutterError.onError in release builds
              final navigator = Navigator.of(context);
              navigator.pushNamed('/non_existent_route');
            },
          ),
        ],
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
          "This is an exception using Chain.capture from an async block");
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

  void _noMethodChannel() async {
    await MethodChannel('non_existent_channel')
        .invokeMethod('non_existent_method');
  }
}

class TextOverflowWidget extends StatelessWidget {
  const TextOverflowWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Text Overflow Example'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Row(
        children: [
          Container(width: 200),
          Container(width: 200),
        ],
      ),
    );
  }
}
