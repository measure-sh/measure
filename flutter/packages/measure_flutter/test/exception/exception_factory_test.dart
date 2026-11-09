import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/exception/exception_factory.dart';
import 'package:measure_flutter/src/exception/exception_severity.dart';

void main() {
  test('truncates the exception message to 8192 characters', () {
    final details = FlutterErrorDetails(
      exception: 'a' * 10000,
      stack: StackTrace.fromString('#0      main (package:app/main.dart:1:1)'),
    );

    final data = ExceptionFactory.from(details, ExceptionSeverity.handled)!;

    expect(data.exceptions.first.message, equals('a' * 8192));
  });
}
