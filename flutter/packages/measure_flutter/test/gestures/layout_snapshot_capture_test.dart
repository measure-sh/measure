import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_capture.dart';

void main() {
  group('LayoutSnapshotCapture', () {
    testWidgets('returns null for null element', (WidgetTester tester) async {
      final result = LayoutSnapshotCapture.captureTree(null);

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
      final result = LayoutSnapshotCapture.captureTree(element);

      expect(result, isNotNull);
      expect(result!.snapshot.widgetName, equals('Scaffold'));
      expect(result.snapshot.children, isNotEmpty);

      // Should contain the included widgets
      final hasButton = _containsWidgetType(result.snapshot, 'ElevatedButton');
      final hasIconButton = _containsWidgetType(result.snapshot, 'IconButton');
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
      final result = LayoutSnapshotCapture.captureTree(element);

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

      final result = LayoutSnapshotCapture.captureTree(
        element,
        detectionPosition: buttonCenter,
        detectionMode: DetectionMode.click,
      );

      expect(result, isNotNull);
      expect(result!.detectedElement, isNotNull);
      expect(result.detectedElementType, equals('ElevatedButton'));

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

      final result = LayoutSnapshotCapture.captureTree(
        element,
        detectionPosition: listViewCenter,
        detectionMode: DetectionMode.scroll,
      );

      expect(result, isNotNull);
      expect(result!.detectedElement, isNotNull);
      expect(result.detectedElementType, equals('ListView'));

      // ListView should be marked as scrollable
      final listViewSnapshot = _findWidgetByType(result.snapshot, 'ListView');
      expect(listViewSnapshot, isNotNull);
      expect(listViewSnapshot!.scrollable, isTrue);
    });

    testWidgets('extracts ValueKey as id', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ElevatedButton(
              key: const ValueKey('my-button-id'),
              onPressed: () {},
              child: const Text('Button'),
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(MaterialApp));
      final result = LayoutSnapshotCapture.captureTree(element);

      expect(result, isNotNull);
      final buttonSnapshot =
          _findWidgetByType(result!.snapshot, 'ElevatedButton');
      expect(buttonSnapshot, isNotNull);
      expect(buttonSnapshot!.id, equals('my-button-id'));
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
      final result = LayoutSnapshotCapture.captureTree(element);

      expect(result, isNotNull);
      // Should have nested structure: Scaffold -> Column -> Container -> Row -> Buttons
      expect(result!.snapshot.widgetName, equals('Scaffold'));
      expect(result.snapshot.children, isNotEmpty);

      // Verify nested widgets are captured
      expect(_containsWidgetType(result.snapshot, 'Column'), isTrue);
      expect(_containsWidgetType(result.snapshot, 'Container'), isTrue);
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

      // Only capture widgets in the top portion of the screen
      final screenBounds = Rect.fromLTWH(0, 0, 400, button1Rect.bottom + 10);

      final result = LayoutSnapshotCapture.captureTree(
        element,
        screenBounds: screenBounds,
      );

      expect(result, isNotNull);
      // Button 1 should be in the tree (within bounds)
      final button1 = _findWidgetById(result!.snapshot, 'button-1');
      expect(button1, isNotNull);

      // Button 2 should not be in the tree (outside bounds)
      final button2 = _findWidgetById(result.snapshot, 'button-2');
      expect(button2, isNull);
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
      final result = LayoutSnapshotCapture.captureTree(element);

      expect(result, isNotNull);
      // Visible button should be captured
      expect(_containsWidgetType(result!.snapshot, 'ElevatedButton'), isTrue);

      // Hidden button should not be captured
      final hiddenButton = _findWidgetById(result.snapshot, 'hidden-button');
      expect(hiddenButton, isNull);
    });

    testWidgets('finds topmost Scaffold in nested navigation',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Navigator(
            pages: [
              MaterialPage(
                child: Scaffold(
                  key: const ValueKey('background-scaffold'),
                  body: Container(),
                ),
              ),
              MaterialPage(
                child: Scaffold(
                  key: const ValueKey('topmost-scaffold'),
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
      final result = LayoutSnapshotCapture.captureTree(element);

      expect(result, isNotNull);
      // Should start from the topmost scaffold
      expect(result!.snapshot.widgetName, equals('Scaffold'));
      expect(result.snapshot.id, equals('topmost-scaffold'));
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
      final result = LayoutSnapshotCapture.captureTree(element);

      expect(result, isNotNull);
      final buttonSnapshot =
          _findWidgetByType(result!.snapshot, 'ElevatedButton');

      expect(buttonSnapshot, isNotNull);
      expect(buttonSnapshot!.width, greaterThan(0));
      expect(buttonSnapshot.height, greaterThan(0));
      expect(buttonSnapshot.x, greaterThanOrEqualTo(0));
      expect(buttonSnapshot.y, greaterThanOrEqualTo(0));
    });

    testWidgets('finds CupertinoPageScaffold as root',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            navigationBar: const CupertinoNavigationBar(
              middle: Text('Title'),
            ),
            child: Center(
              child: CupertinoButton(
                onPressed: () {},
                child: const Text('Button'),
              ),
            ),
          ),
        ),
      );

      final element = tester.element(find.byType(CupertinoApp));
      final result = LayoutSnapshotCapture.captureTree(element);

      expect(result, isNotNull);
      // Should start from CupertinoPageScaffold
      expect(result!.snapshot.widgetName, equals('CupertinoPageScaffold'));
      expect(_containsWidgetType(result.snapshot, 'CupertinoButton'), isTrue);
    });

    testWidgets('finds topmost CupertinoPageScaffold in nested navigation',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        CupertinoApp(
          home: Navigator(
            pages: [
              MaterialPage(
                child: CupertinoPageScaffold(
                  key: const ValueKey('background-scaffold'),
                  child: Container(),
                ),
              ),
              MaterialPage(
                child: CupertinoPageScaffold(
                  key: const ValueKey('topmost-scaffold'),
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
      final result = LayoutSnapshotCapture.captureTree(element);

      expect(result, isNotNull);
      // Should start from the topmost CupertinoPageScaffold
      expect(result!.snapshot.widgetName, equals('CupertinoPageScaffold'));
      expect(result.snapshot.id, equals('topmost-scaffold'));
    });
  });

  group('LayoutSnapshot', () {
    test('toJson includes all fields', () {
      final snapshot = LayoutSnapshot(
        widgetName: 'TestWidget',
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

    test('toJson excludes null id', () {
      final snapshot = LayoutSnapshot(
        widgetName: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final json = snapshot.toJson();

      expect(json.containsKey('id'), isFalse);
    });

    test('toJson includes nested children', () {
      final snapshot = LayoutSnapshot(
        widgetName: 'Parent',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        children: [
          LayoutSnapshot(
            widgetName: 'Child',
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
bool _containsWidgetType(LayoutSnapshot snapshot, String widgetType) {
  if (snapshot.widgetName == widgetType) {
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
LayoutSnapshot? _findWidgetByType(LayoutSnapshot snapshot, String widgetType) {
  if (snapshot.widgetName == widgetType) {
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
LayoutSnapshot? _findWidgetById(LayoutSnapshot snapshot, String id) {
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
