import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/gestures/gesture_label_extractor.dart';

void main() {
  group('extractGestureLabels', () {
    testWidgets('captures a button label', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ElevatedButton(
            onPressed: () {},
            child: const Text('Add to cart'),
          ),
        ),
      );

      final labels =
          extractGestureLabels(tester.element(find.byType(ElevatedButton)));

      expect(labels.label, 'Add to cart');
    });

    testWidgets('captures only the first text in a container', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              key: const Key('card'),
              children: const [
                Text('one'),
                Text('two'),
                Text('three'),
                Text('four'),
              ],
            ),
          ),
        ),
      );

      final labels =
          extractGestureLabels(tester.element(find.byKey(const Key('card'))));

      expect(labels.label, 'one');
    });

    testWidgets('truncates to 32 chars with ellipsis', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Center(
            key: const Key('root'),
            child: const Text('This is a very long label exceeding limit'),
          ),
        ),
      );

      final labels =
          extractGestureLabels(tester.element(find.byKey(const Key('root'))));

      expect(labels.label!.length, lessThanOrEqualTo(32));
      expect(labels.label!.endsWith('…'), isTrue);
    });

    testWidgets('does not capture text from input fields', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TextField(
              key: const Key('field'),
              controller: TextEditingController(text: 'secret value'),
              decoration: const InputDecoration(labelText: 'Password'),
            ),
          ),
        ),
      );

      final labels =
          extractGestureLabels(tester.element(find.byKey(const Key('field'))));

      expect(labels.label, isNull);
    });

    testWidgets('does not capture icon-glyph-only text', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Center(
            key: const Key('root'),
            child: Text(
              String.fromCharCode(Icons.add.codePoint),
              style: TextStyle(fontFamily: Icons.add.fontFamily),
            ),
          ),
        ),
      );

      final labels =
          extractGestureLabels(tester.element(find.byKey(const Key('root'))));

      expect(labels.label, isNull);
    });

    testWidgets('captures the semantic label', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Semantics(
            key: const Key('root'),
            label: 'Add item to cart',
            child: const SizedBox(width: 10, height: 10),
          ),
        ),
      );

      final labels =
          extractGestureLabels(tester.element(find.byKey(const Key('root'))));

      expect(labels.semanticLabel, 'Add item to cart');
    });
  });
}
