import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:measure_flutter/measure_flutter.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('getPlatformVersion test', (WidgetTester tester) async {
    final MeasureFlutter plugin = MeasureFlutter();
    final String? version = await plugin.getPlatformVersion();
    // The version string depends on the host platform running the test, so
    // just assert that some non-empty string is returned.
    expect(version?.isNotEmpty, true);
  });
}
