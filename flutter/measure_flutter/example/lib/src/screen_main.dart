import 'dart:isolate';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:measure_flutter/attribute_builder.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter_example/src/example_dio_interceptor.dart';
import 'package:measure_flutter_example/src/example_http_client.dart';
import 'package:measure_flutter_example/src/screen_navigation.dart';
import 'package:stack_trace/stack_trace.dart';

import 'list_item.dart';
import 'screen_text_overflow.dart';

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
          ListSection(title: "Crashes"),
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
                MaterialPageRoute<ScreenTextOverflow>(
                  builder: (context) => const ScreenTextOverflow(),
                  settings: RouteSettings(name: '/screen_text_overflow'),
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
          ListSection(title: "Navigation"),
          ListItem(
            title: "Navigate",
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute<ScreenNavigation>(
                  builder: (context) => const ScreenNavigation(),
                  settings: RouteSettings(name: '/screen_navigation'),
                ),
              );
            },
          ),
          ListSection(title: "http"),
          ListItem(title: "Custom HTTP Client", onPressed: _makeHttpRequest),
          ListItem(title: "Dio", onPressed: _makeDioHttpRequest)
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

  void _makeHttpRequest() async {
    final client = ExampleHttpClient(http.Client());
    final url = Uri.https('example.com', 'whatsit/create');
    try {
      final response =
          await client.post(url, body: {'name': 'doodle', 'color': 'blue'});
      print('Response status: ${response.statusCode}');
      print('Response body: ${response.body}');
    } catch (e) {
      // ignore-errors
    }

    try {
      print(await client.read(Uri.https('example.com', 'foobar.txt')));
    } catch(e) {
      // ignore-errors
    }
  }

  void _makeDioHttpRequest() async {
    final dio = Dio();
    dio.interceptors.add(ExampleDioInterceptor());
    try {
      final response = await dio.get('https://dart.dev');
      print(response.data);
    } catch (e) {
      // ignore-errors
    }
  }
}

class ListSection extends StatelessWidget {
  final String title;

  const ListSection({
    super.key,
    required this.title,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Colors.grey[600],
        ),
      ),
      dense: true,
      enabled: false,
      contentPadding: EdgeInsets.symmetric(horizontal: 16),
    );
  }
}
