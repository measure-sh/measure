import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_capture.dart';

void main() {
  group('LayoutSnapshotCapture', () {
    testWidgets('returns null for null element', (WidgetTester tester) async {
      final result = LayoutSnapshotCapture.capture(null);

      expect(result, isNull);
    });

    testWidgets('captures basic widget tree structure',
        (WidgetTester tester) async {
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

    testWidgets('includes important widgets and filters out unimportant ones',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                const Text('Text content'),
                const SizedBox(height: 20),
                const Padding(
                  padding: EdgeInsets.all(8),
                  child: Text('More text'),
                ),
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Button'),
                ),
              ],
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      // Important widgets should be included
      expect(_containsWidgetType(result!.snapshot, 'Text'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'ElevatedButton'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'Column'), isTrue);
      // Unimportant layout widgets should be filtered out
      expect(_containsWidgetType(result.snapshot, 'SizedBox'), isFalse);
      expect(_containsWidgetType(result.snapshot, 'Padding'), isFalse);
    });

    testWidgets('detects clickable widget at position',
        (WidgetTester tester) async {
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
      final buttonCenter =
          tester.getCenter(find.byKey(const ValueKey('test-button')));

      final result = LayoutSnapshotCapture.capture(
        element,
        detectionPosition: buttonCenter,
        detectionMode: GestureDetectionMode.click,
      );

      expect(result, isNotNull);
      expect(result!.gestureElement, isNotNull);
      expect(result.gestureElementType, equals('ElevatedButton'));

      // The detected button should be highlighted in the tree
      final buttonSnapshot =
          _findWidgetByType(result.snapshot, 'ElevatedButton');
      expect(buttonSnapshot, isNotNull);
      expect(buttonSnapshot!.highlighted, isTrue);
    });

    testWidgets('detects scrollable widget at position',
        (WidgetTester tester) async {
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

    testWidgets('captures nested widget hierarchy',
        (WidgetTester tester) async {
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
      final button1Rect =
          tester.getRect(find.byKey(const ValueKey('button-1')));
      final button2Rect =
          tester.getRect(find.byKey(const ValueKey('button-2')));

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

      // Hidden button should not be captured
      final hiddenButton = _findWidgetById(result.snapshot, 'hidden-button');
      expect(hiddenButton, isNull);
    });

    testWidgets('captures nested navigation with multiple scaffolds',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Navigator(
            pages: [
              MaterialPage(
                child: Scaffold(
                  body: Container(),
                ),
              ),
              MaterialPage(
                child: Scaffold(
                  body: ElevatedButton(
                    onPressed: () {},
                    child: const Text('Button'),
                  ),
                ),
              ),
            ],
            onDidRemovePage: (page) => false,
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      // MaterialApp is the root
      expect(result!.snapshot.label, equals('MaterialApp'));
      // Both scaffolds are captured (occlusion removal can be applied separately)
      final scaffoldCount = _countWidgetsByType(result.snapshot, 'Scaffold');
      expect(scaffoldCount, greaterThanOrEqualTo(1));
      // Should contain the button from the topmost scaffold
      expect(_containsWidgetType(result.snapshot, 'ElevatedButton'), isTrue);
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
      final buttonSnapshot =
          _findWidgetByType(result!.snapshot, 'ElevatedButton');

      expect(buttonSnapshot, isNotNull);
      expect(buttonSnapshot!.width, greaterThan(0));
      expect(buttonSnapshot.height, greaterThan(0));
      expect(buttonSnapshot.x, greaterThanOrEqualTo(0));
      expect(buttonSnapshot.y, greaterThanOrEqualTo(0));
    });

    testWidgets('captures nested navigation with multiple CupertinoPageScaffolds',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        CupertinoApp(
          home: Navigator(
            pages: [
              MaterialPage(
                child: CupertinoPageScaffold(
                  child: Container(),
                ),
              ),
              MaterialPage(
                child: CupertinoPageScaffold(
                  child: CupertinoButton(
                    onPressed: () {},
                    child: const Text('Button'),
                  ),
                ),
              ),
            ],
            onDidRemovePage: (page) => false,
          ),
        ),
      );

      final element = tester.element(find.byType(CupertinoApp));
      final result = LayoutSnapshotCapture.capture(element);

      expect(result, isNotNull);
      // CupertinoApp is the root
      expect(result!.snapshot.label, equals('CupertinoApp'));
      // Both scaffolds are captured (occlusion removal can be applied separately)
      final scaffoldCount = _countWidgetsByType(result.snapshot, 'CupertinoPageScaffold');
      expect(scaffoldCount, greaterThanOrEqualTo(1));
      // Should contain the button from the topmost scaffold
      expect(_containsWidgetType(result.snapshot, 'CupertinoButton'), isTrue);
    });

    testWidgets('uses framework widgets when widgets filter input is null',
        (WidgetTester tester) async {
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

    testWidgets('uses framework widgets when widgets filter input is empty',
        (WidgetTester tester) async {
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

    testWidgets(
        'uses widgets in widgets filter when provided',
        (WidgetTester tester) async {
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
      // Only custom widget should be included
      expect(_containsWidgetType(result!.snapshot, 'CustomWidget'), isTrue);

      // Framework widgets should be excluded
      expect(_containsWidgetType(result.snapshot, 'ElevatedButton'), isFalse);
      expect(_containsWidgetType(result.snapshot, 'Text'), isFalse);
      expect(_containsWidgetType(result.snapshot, 'Column'), isFalse);
    });

    testWidgets(
        'includes multiple custom widgets when widgets filter input has multiple entries',
        (WidgetTester tester) async {
      final customWidget1 =
          _CustomWidget(key: const ValueKey('custom-widget-1'));
      final customWidget2 =
          _AnotherCustomWidget(key: const ValueKey('custom-widget-2'));

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Button'),
                ),
                customWidget1,
                customWidget2,
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
          _AnotherCustomWidget: 'AnotherCustomWidget',
        },
      );

      expect(result, isNotNull);
      // Both custom widgets should be included
      expect(_containsWidgetType(result!.snapshot, 'CustomWidget'), isTrue);
      expect(
          _containsWidgetType(result.snapshot, 'AnotherCustomWidget'), isTrue);

      // Framework widgets should be excluded
      expect(_containsWidgetType(result.snapshot, 'ElevatedButton'), isFalse);
      expect(_containsWidgetType(result.snapshot, 'Column'), isFalse);
    });
  });

  group('LayoutSnapshot', () {
    test('toJson includes all fields', () {
      final snapshot = SnapshotNode(
        label: 'TestWidget',
        x: 10,
        y: 20,
        width: 100,
        height: 200,
        id: 'test-id',
        highlighted: true,
        scrollable: true,
        children: [],
      );

      final json = snapshot.toJson();

      expect(json['label'], equals('TestWidget'));
      expect(json['x'], equals(10));
      expect(json['y'], equals(20));
      expect(json['width'], equals(100));
      expect(json['height'], equals(200));
      expect(json['id'], equals('test-id'));
      expect(json['highlighted'], equals(true));
      expect(json['scrollable'], equals(true));
    });

    test('toJson includes nested children', () {
      final snapshot = SnapshotNode(
        label: 'Parent',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        children: [
          SnapshotNode(
            label: 'Child',
            x: 10,
            y: 10,
            width: 50,
            height: 50,
            children: [],
          ),
        ],
      );

      final json = snapshot.toJson();

      expect(json['children'], isNotNull);
      expect(json['children'], isList);
      expect((json['children'] as List).length, equals(1));
      expect((json['children'] as List)[0]['label'], equals('Child'));
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

// Helper function to count how many widgets of a specific type exist in the tree
int _countWidgetsByType(SnapshotNode snapshot, String widgetType) {
  int count = snapshot.label == widgetType ? 1 : 0;
  for (final child in snapshot.children) {
    count += _countWidgetsByType(child, widgetType);
  }
  return count;
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

// Helper function to find a widget by id
SnapshotNode? _findWidgetById(SnapshotNode snapshot, String id) {
  if (snapshot.id == id) {
    return snapshot;
  }
  for (final child in snapshot.children) {
    final result = _findWidgetById(child, id);
    if (result != null) {
      return result;
    }
  }
  return null;
}

// Helper function to find a node at a specific position
SnapshotNode? _findNodeAtPosition(SnapshotNode snapshot, Offset position) {
  final bounds = Rect.fromLTWH(snapshot.x, snapshot.y, snapshot.width, snapshot.height);
  if (!bounds.contains(position)) {
    return null;
  }

  // Check children first (they are on top)
  for (final child in snapshot.children) {
    final result = _findNodeAtPosition(child, position);
    if (result != null) {
      return result;
    }
  }

  // If no child contains the position, return this node
  return snapshot;
}

// Helper function to collect bounds of all ElevatedButton nodes
void _collectButtonBounds(SnapshotNode snapshot, List<Rect> output) {
  if (snapshot.label == 'ElevatedButton') {
    output.add(Rect.fromLTWH(snapshot.x, snapshot.y, snapshot.width, snapshot.height));
  }
  for (final child in snapshot.children) {
    _collectButtonBounds(child, output);
  }
}

// Custom test widgets for testing providedWidgetsTypes
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

class _AnotherCustomWidget extends StatelessWidget {
  const _AnotherCustomWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 100,
      height: 100,
      color: Colors.red,
    );
  }
}
