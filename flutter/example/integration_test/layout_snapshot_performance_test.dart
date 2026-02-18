import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:measure_flutter/measure_flutter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Layout snapshot performance test', (WidgetTester tester) async {
    await Measure.instance.init(
      () {},
      config: const MeasureConfig(
        enableLogging: false,
        autoStart: true,
      ),
    );

    await tester.pumpWidget(
      MeasureWidget(
        child: MaterialApp(
          home: Scaffold(
            appBar: AppBar(title: const Text('Perf Test')),
            body: _buildDeeplyNestedButton(50),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    final buttonFinder = find.byKey(const ValueKey('test_button'));
    expect(buttonFinder, findsOneWidget);

    await binding.traceAction(
      () async {
        for (int i = 0; i < 30; i++) {
          await tester.tap(buttonFinder);
          await tester.pump();
          await Future.delayed(const Duration(milliseconds: 750));
        }
      },
      reportKey: 'layout_snapshot',
    );
  });
}

Widget _buildDeeplyNestedButton(int depth) {
  return Stack(
    children: [
      _buildDeeplyNestedContainer(depth),
      Center(
        child: ElevatedButton(
          key: const ValueKey('test_button'),
          onPressed: () {},
          child: const Text('Tap Me'),
        ),
      ),
    ],
  );
}

Widget _buildDeeplyNestedContainer(int depth) {
  if (depth <= 0) {
    return const SizedBox.shrink();
  }

  // Alternate between different container types for variety
  if (depth % 4 == 0) {
    return Container(
      padding: const EdgeInsets.all(1),
      child: _buildDeeplyNestedContainer(depth - 1),
    );
  } else if (depth % 4 == 1) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: _buildDeeplyNestedContainer(depth - 1),
        ),
      ],
    );
  } else if (depth % 4 == 2) {
    return Container(
      margin: const EdgeInsets.all(1),
      child: _buildDeeplyNestedContainer(depth - 1),
    );
  } else {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: _buildDeeplyNestedContainer(depth - 1),
        ),
      ],
    );
  }
}
