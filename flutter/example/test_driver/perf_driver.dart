// ignore_for_file: avoid_print

import 'dart:convert';
import 'dart:io';
import 'package:flutter_driver/flutter_driver.dart' as driver;
import 'package:integration_test/integration_test_driver.dart';

Future<void> main() {
  return integrationDriver(
    responseDataCallback: (data) async {
      if (data != null && data['layout_snapshot'] != null) {
        final timeline = driver.Timeline.fromJson(
          data['layout_snapshot'] as Map<String, dynamic>,
        );

        final file = File('build/layout_snapshot.timeline.json');
        await file.writeAsString(jsonEncode(timeline.json));
        final absolutePath = file.absolute.path;
        print('\n=== Performance Test Results ===');
        print('Open: chrome://tracing');
        print('Then load: $absolutePath\n');
      }
    },
  );
}
