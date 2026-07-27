import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/config/measure_config.dart';
import 'package:measure_flutter/src/measure_initializer.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('passes every MeasureConfig field to the config provider', () {
    final initializer = MeasureInitializer(
      const MeasureConfig(
        enableLogging: true,
        autoStart: false,
        enableDiagnosticMode: true,
        widgetFilter: {ElevatedButton: 'CheckoutButton'},
      ),
    );

    final provider = initializer.configProvider;
    expect(provider.enableLogging, true);
    expect(provider.autoStart, false);
    expect(provider.enableDiagnosticMode, true);
    expect(provider.widgetFilter, {ElevatedButton: 'CheckoutButton'});
  });
}
