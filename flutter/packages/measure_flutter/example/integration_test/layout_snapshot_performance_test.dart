import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_capture.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Performance test: captureTree with 100 deeply nested widgets',
      (WidgetTester tester) async {
    // Build a deeply nested widget tree with 100 widgets
    final testWidget = MaterialApp(
      home: Scaffold(
        body: _buildDeeplyNestedWidget(100),
      ),
    );

    await tester.pumpWidget(testWidget);
    await tester.pumpAndSettle();

    // Get the root element
    final rootElement = tester.binding.rootElement;

    // Measure captureTree performance using traceAction
    await binding.traceAction(
      () async {
        // Call captureTree multiple times to get consistent measurements
        for (int i = 0; i < 10; i++) {
          LayoutSnapshotCapture.captureTree(rootElement);
        }
      },
      reportKey: 'captureTree_deep_100',
    );
  });
}

/// Builds a deeply nested widget tree with the specified depth
/// Pattern: Container > Row > Container > Column (alternating)
Widget _buildDeeplyNestedWidget(int depth) {
  if (depth <= 0) {
    return const Text('Leaf');
  }

  // Alternate between different container types for variety
  if (depth % 4 == 0) {
    return Container(
      padding: const EdgeInsets.all(1),
      child: _buildDeeplyNestedWidget(depth - 1),
    );
  } else if (depth % 4 == 1) {
    return Row(
      children: [
        Expanded(child: _buildDeeplyNestedWidget(depth - 1)),
      ],
    );
  } else if (depth % 4 == 2) {
    return Container(
      margin: const EdgeInsets.all(1),
      child: _buildDeeplyNestedWidget(depth - 1),
    );
  } else {
    return Column(
      children: [
        Expanded(child: _buildDeeplyNestedWidget(depth - 1)),
      ],
    );
  }
}
