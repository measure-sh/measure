import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_capture.dart';
import 'package:measure_flutter/src/gestures/snapshot_node.dart';

void main() {
  group('LayoutSnapshotCapture', () {
    testWidgets('returns null for null element', (WidgetTester tester) async {
      final result = LayoutSnapshotCapture.capture(null);

      expect(result, isNull);
    });

    testWidgets('captures basic widget tree structure', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Button 1'),
                ),
                IconButton(
                  onPressed: () {},
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      // With ancestor support, MaterialApp is now the root with Scaffold nested inside
      expect(result!.snapshot.label, equals('MaterialApp'));
      expect(result.snapshot.children, isNotEmpty);

      // Should contain the Scaffold and the included widgets
      final hasScaffold = _containsWidgetType(result.snapshot, 'Scaffold');
      final hasButton = _containsWidgetType(result.snapshot, 'ElevatedButton');
      final hasIconButton = _containsWidgetType(result.snapshot, 'IconButton');
      expect(hasScaffold, isTrue);
      expect(hasButton, isTrue);
      expect(hasIconButton, isTrue);
    });

    testWidgets('detects clickable widget at position', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: ElevatedButton(
                key: const ValueKey('test-button'),
                onPressed: () {},
                child: const Text('Click me'),
              ),
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final buttonCenter = tester.getCenter(find.byKey(const ValueKey('test-button')));

      final result = LayoutSnapshotCapture.capture(
        element,
        detectionPosition: buttonCenter,
        detectionMode: GestureDetectionMode.click,
      );

      // We detect the inner most widget which can take the gesture,
      // ElevatedButton uses a GestureDetector internally.
      expect(result, isNotNull);
      expect(result!.gestureElement, isNotNull);
      expect(result.gestureElementType, equals('GestureDetector'));

      final gdSnapshot = _findWidgetByType(result.snapshot, 'GestureDetector');
      expect(gdSnapshot, isNotNull);
      expect(gdSnapshot!.highlighted, isTrue);
    });

    testWidgets('detects scrollable widget at position', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView(
              children: List.generate(
                10,
                (index) => ListTile(title: Text('Item $index')),
              ),
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final listViewCenter = tester.getCenter(find.byType(ListView));

      final result = LayoutSnapshotCapture.capture(
        element,
        detectionPosition: listViewCenter,
        detectionMode: GestureDetectionMode.scroll,
      );

      expect(result, isNotNull);
      expect(result!.gestureElement, isNotNull);
      expect(result.gestureElementType, equals('ListView'));

      // ListView should be marked as scrollable
      final listViewSnapshot = _findWidgetByType(result.snapshot, 'ListView');
      expect(listViewSnapshot, isNotNull);
      expect(listViewSnapshot!.scrollable, isTrue);
    });

    testWidgets('captures nested widget hierarchy', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                Row(
                  children: [
                    ElevatedButton(
                      onPressed: () {},
                      child: const Text('Button 1'),
                    ),
                    IconButton(
                      onPressed: () {},
                      icon: const Icon(Icons.star),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      // With ancestor support, MaterialApp is the root with nested structure inside
      expect(result!.snapshot.label, equals('MaterialApp'));
      expect(result.snapshot.children, isNotEmpty);

      // Verify nested widgets are captured: MaterialApp -> Scaffold -> Column -> Row -> Buttons
      expect(_containsWidgetType(result.snapshot, 'Scaffold'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'Column'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'Row'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'ElevatedButton'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'IconButton'), isTrue);
    });

    testWidgets('filters by screen bounds', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ElevatedButton(
                  key: const ValueKey('button-1'),
                  onPressed: () {},
                  child: const Text('Button 1'),
                ),
                const SizedBox(height: 500),
                ElevatedButton(
                  key: const ValueKey('button-2'),
                  onPressed: () {},
                  child: const Text('Button 2'),
                ),
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final button1Rect = tester.getRect(find.byKey(const ValueKey('button-1')));
      final button2Rect = tester.getRect(find.byKey(const ValueKey('button-2')));

      // Only capture widgets in the top portion of the screen
      final screenBounds = Rect.fromLTWH(0, 0, 400, button1Rect.bottom + 10);

      final result = LayoutSnapshotCapture.capture(
        element,
        screenBounds: screenBounds,
      );

      expect(result, isNotNull);

      // Collect all button bounds from the snapshot
      final buttonBounds = <Rect>[];
      _collectButtonBounds(result!.snapshot, buttonBounds);

      // Button 1 should be in the tree (within bounds) - check overlap with button1Rect
      final hasButton1 = buttonBounds.any((bounds) => bounds.overlaps(button1Rect));
      expect(hasButton1, isTrue);

      // Button 2 should not be in the tree (outside bounds) - check no overlap with button2Rect
      final hasButton2 = buttonBounds.any((bounds) => bounds.overlaps(button2Rect));
      expect(hasButton2, isFalse);
    });

    testWidgets('skips offstage widgets', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Visible Button'),
                ),
                Offstage(
                  offstage: true,
                  child: ElevatedButton(
                    key: const ValueKey('hidden-button'),
                    onPressed: () {},
                    child: const Text('Hidden Button'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      // Visible button should be captured
      expect(_containsWidgetType(result!.snapshot, 'ElevatedButton'), isTrue);

      // Hidden button should not be captured - only the visible one should exist
      expect(_countWidgetType(result.snapshot, 'ElevatedButton'), equals(1));
    });

    testWidgets('skips invisible widgets', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Visible Button'),
                ),
                Visibility(
                  visible: false,
                  child: ElevatedButton(
                    key: const ValueKey('hidden-button'),
                    onPressed: () {},
                    child: const Text('Hidden Button'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      // Visible button should be captured
      expect(_containsWidgetType(result!.snapshot, 'ElevatedButton'), isTrue);

      // Hidden button should not be captured - only the visible one should exist
      expect(_countWidgetType(result.snapshot, 'ElevatedButton'), equals(1));
    });

    testWidgets('skips widgets with no opacity', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Visible Button'),
                ),
                Opacity(
                  opacity: 0,
                  child: ElevatedButton(
                    key: const ValueKey('hidden-button'),
                    onPressed: () {},
                    child: const Text('Hidden Button'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      // Visible button should be captured
      expect(_containsWidgetType(result!.snapshot, 'ElevatedButton'), isTrue);

      // Hidden button should not be captured - only the visible one should exist
      expect(_countWidgetType(result.snapshot, 'ElevatedButton'), equals(1));
    });

    testWidgets('captures bounds correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 200,
                height: 100,
                child: ElevatedButton(
                  onPressed: () {},
                  child: const Text('Button'),
                ),
              ),
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      final buttonSnapshot = _findWidgetByType(result!.snapshot, 'ElevatedButton');

      expect(buttonSnapshot, isNotNull);
      expect(buttonSnapshot!.width, greaterThan(0));
      expect(buttonSnapshot.height, greaterThan(0));
      expect(buttonSnapshot.x, greaterThanOrEqualTo(0));
      expect(buttonSnapshot.y, greaterThanOrEqualTo(0));
    });

    testWidgets('uses framework widgets when widgets filter input is null', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Button'),
                ),
                const Text('Text content'),
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(
        element,
        widgetFilter: null,
      );

      expect(result, isNotNull);
      // Framework widgets should be included
      expect(_containsWidgetType(result!.snapshot, 'ElevatedButton'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'Text'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'Column'), isTrue);
    });

    testWidgets('uses framework widgets when widgets filter input is empty', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Button'),
                ),
                const Text('Text content'),
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(
        element,
        widgetFilter: {},
      );

      expect(result, isNotNull);
      // Framework widgets should be included
      expect(_containsWidgetType(result!.snapshot, 'ElevatedButton'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'Text'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'Column'), isTrue);
    });

    testWidgets('uses widgets in widgets filter if provided', (WidgetTester tester) async {
      // Create a custom widget
      final customWidget = _CustomWidget(key: const ValueKey('custom-widget'));

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Button'),
                ),
                const Text('Text content'),
                customWidget,
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(
        element,
        widgetFilter: {
          _CustomWidget: 'CustomWidget',
        },
      );

      expect(result, isNotNull);
      expect(_containsWidgetType(result!.snapshot, 'CustomWidget'), isTrue);
    });

    testWidgets('sets element type for button widgets', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () {},
                child: const Text('Test Button'),
              ),
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      final buttonSnapshot = _findWidgetByType(result!.snapshot, 'ElevatedButton');

      expect(buttonSnapshot, isNotNull);
      expect(buttonSnapshot!.type, equals('button'));
    });
  });
}

// Helper function to check if a widget type exists in the tree
bool _containsWidgetType(SnapshotNode snapshot, String widgetType) {
  if (snapshot.label == widgetType) {
    return true;
  }
  for (final child in snapshot.children) {
    if (_containsWidgetType(child, widgetType)) {
      return true;
    }
  }
  return false;
}

// Helper function to find a widget by type
SnapshotNode? _findWidgetByType(SnapshotNode snapshot, String widgetType) {
  if (snapshot.label == widgetType) {
    return snapshot;
  }
  for (final child in snapshot.children) {
    final result = _findWidgetByType(child, widgetType);
    if (result != null) {
      return result;
    }
  }
  return null;
}

// Helper function to count widgets of a given type in the tree
int _countWidgetType(SnapshotNode snapshot, String widgetType) {
  int count = snapshot.label == widgetType ? 1 : 0;
  for (final child in snapshot.children) {
    count += _countWidgetType(child, widgetType);
  }
  return count;
}

// Helper function to collect bounds of ElevatedButton widgets
void _collectButtonBounds(SnapshotNode snapshot, List<Rect> output) {
  if (snapshot.label == 'ElevatedButton') {
    output.add(Rect.fromLTWH(snapshot.x, snapshot.y, snapshot.width, snapshot.height));
  }
  for (final child in snapshot.children) {
    _collectButtonBounds(child, output);
  }
}

class _CustomWidget extends StatelessWidget {
  const _CustomWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 100,
      height: 100,
      color: Colors.blue,
    );
  }
}
