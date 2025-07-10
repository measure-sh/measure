import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/msr_gesture_detector.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/gestures/scroll_direction.dart';

void main() {
  group('MsrGestureDetector', () {
    Widget createTestWidget({
      Widget? child,
      Function(ClickData)? onClick,
      Function(LongClickData)? onLongClick,
      Function(ScrollData)? onScroll,
    }) {
      return MaterialApp(
        home: Scaffold(
          body: MsrGestureDetector(
            onClick: onClick ?? (data) {},
            onLongClick: onLongClick ?? (data) {},
            onScroll: onScroll ?? (data) {},
            child: child ??
                SizedBox(
                  width: 200,
                  height: 200,
                  child: Column(
                    children: [
                      ElevatedButton(
                        onPressed: () {},
                        child: const Text('Test Button'),
                      ),
                      const SizedBox(height: 20),
                      ListView(
                        shrinkWrap: true,
                        children: const [
                          ListTile(title: Text('Item 1')),
                          ListTile(title: Text('Item 2')),
                        ],
                      ),
                    ],
                  ),
                ),
          ),
        ),
      );
    }

    group('Click Detection', () {
      testWidgets('should detect click on clickable element',
          (WidgetTester tester) async {
        final clickEvents = <ClickData>[];

        await tester.pumpWidget(createTestWidget(
          onClick: (data) => clickEvents.add(data),
        ));

        // Tap the button
        await tester.tap(find.byType(ElevatedButton));
        await tester.pump();

        expect(clickEvents, hasLength(1));
        expect(clickEvents.first.target, 'ElevatedButton');
        expect(clickEvents.first.x, greaterThan(0));
        expect(clickEvents.first.y, greaterThan(0));
        expect(clickEvents.first.targetId, 'Test Button');
      });

      testWidgets('should not detect click on non-clickable element',
          (WidgetTester tester) async {
        final clickEvents = <ClickData>[];

        await tester.pumpWidget(createTestWidget(
          onClick: (data) => clickEvents.add(data),
          child: SizedBox(
            width: 200,
            height: 200,
            child: const Text('Non-clickable text'),
          ),
        ));

        // Tap the container
        await tester.tap(find.byType(SizedBox));
        await tester.pump();

        expect(clickEvents, isEmpty);
      });

      testWidgets('should detect click on various clickable widgets',
          (WidgetTester tester) async {
        final clickEvents = <ClickData>[];

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: MsrGestureDetector(
              onClick: (data) => clickEvents.add(data),
              onLongClick: (data) {},
              onScroll: (data) {},
              child: Column(
                children: [
                  IconButton(
                    key: ValueKey("IconButton"),
                    onPressed: () {},
                    icon: const Icon(Icons.add),
                  ),
                  const ListTile(
                    key: ValueKey("ListTile"),
                    title: Text('List Item'),
                  ),
                  InkWell(
                    key: ValueKey("InkWell"),
                    onTap: () {},
                    child: const Text('InkWell'),
                  ),
                  Checkbox(
                    key: ValueKey("Checkbox"),
                    value: true,
                    onChanged: (value) {},
                  ),
                ],
              ),
            ),
          ),
        ));

        // Test IconButton
        await tester.tap(find.byKey(ValueKey("IconButton")));
        await tester.pump();
        expect(clickEvents, hasLength(1));
        expect(clickEvents.last.target, 'IconButton');
        expect(clickEvents.last.targetId, null);

        // Test ListTile
        await tester.tap(find.byKey(ValueKey("ListTile")));
        await tester.pump();
        expect(clickEvents, hasLength(2));
        expect(clickEvents.last.target, 'ListTile');
        expect(clickEvents.last.targetId, 'List Item');

        // Test InkWell
        await tester.tap(find.byKey(ValueKey("InkWell")));
        await tester.pump();
        expect(clickEvents, hasLength(3));
        expect(clickEvents.last.target, 'InkWell');
        expect(clickEvents.last.targetId, 'InkWell');

        // Test Checkbox
        await tester.tap(find.byKey(ValueKey("Checkbox")));
        await tester.pump();
        expect(clickEvents, hasLength(4));
        expect(clickEvents.last.target, 'Checkbox');
        expect(clickEvents.last.targetId, null);
      });

      testWidgets('should truncate long labels', (WidgetTester tester) async {
        final clickEvents = <ClickData>[];
        const longText =
            'This is a very long text that should be truncated to fit within the maximum length limit';

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: MsrGestureDetector(
              onClick: (data) => clickEvents.add(data),
              onLongClick: (data) {},
              onScroll: (data) {},
              child: ElevatedButton(
                onPressed: () {},
                child: const Text(longText),
              ),
            ),
          ),
        ));

        await tester.tap(find.byType(ElevatedButton));
        await tester.pump();

        expect(clickEvents, hasLength(1));
        expect(clickEvents.first.targetId, hasLength(32));
        expect(clickEvents.first.targetId, endsWith('...'));
      });
    });

    group('Long Click Detection', () {
      testWidgets('should detect long click after holding for 500ms',
          (WidgetTester tester) async {
        final clickEvents = <ClickData>[];
        final longClickEvents = <LongClickData>[];

        await tester.pumpWidget(
          createTestWidget(
            onClick: (data) => clickEvents.add(data),
            onLongClick: (data) => longClickEvents.add(data),
          ),
        );

        final center = tester.getCenter(find.byType(ElevatedButton));
        final state = tester.state<MsrGestureDetectorState>(
          find.byType(MsrGestureDetector),
        );

        // Create events with proper timestamps
        final downEvent = TestPointerEvent.createDownEvent(
          position: center,
          timeStamp: const Duration(milliseconds: 100),
        );

        final upEvent = TestPointerEvent.createUpEvent(
          position: center,
          timeStamp: const Duration(milliseconds: 700), // 600ms duration
        );

        // Directly test the event handlers
        state.onPointerDown(downEvent);
        state.onPointerUp(upEvent, 1);

        await tester.pumpAndSettle();

        expect(clickEvents, isEmpty);
        expect(longClickEvents, hasLength(1));
        expect(longClickEvents.first.target, 'ElevatedButton');
        expect(longClickEvents.first.targetId, 'Test Button');
      });
    });

    group('Scroll Detection', () {
      testWidgets('should detect scroll on scrollable widget',
          (WidgetTester tester) async {
        final scrollEvents = <ScrollData>[];

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: MsrGestureDetector(
              onClick: (data) {},
              onLongClick: (data) {},
              onScroll: (data) => scrollEvents.add(data),
              child: SizedBox(
                height: 200,
                child: ListView(
                  children: List.generate(
                    20,
                    (index) => ListTile(title: Text('Item $index')),
                  ),
                ),
              ),
            ),
          ),
        ));

        // Perform scroll gesture
        await tester.drag(find.byType(ListView), const Offset(0, -100));
        await tester.pump();

        expect(scrollEvents, hasLength(1));
        expect(scrollEvents.first.target, 'ListView');
        expect(scrollEvents.first.direction, MsrScrollDirection.up);
        expect(scrollEvents.first.endY, lessThan(scrollEvents.first.y));
      });

      testWidgets('should detect horizontal scroll direction',
          (WidgetTester tester) async {
        final scrollEvents = <ScrollData>[];

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: MsrGestureDetector(
              onClick: (data) {},
              onLongClick: (data) {},
              onScroll: (data) => scrollEvents.add(data),
              child: SizedBox(
                height: 200,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: List.generate(
                    20,
                    (index) => SizedBox(
                      width: 100,
                      child: ListTile(title: Text('Item $index')),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ));

        // Perform horizontal scroll
        await tester.drag(find.byType(ListView), const Offset(-100, 0));
        await tester.pump();

        expect(scrollEvents, hasLength(1));
        expect(scrollEvents.first.direction, MsrScrollDirection.left);
      });

      testWidgets('should not detect scroll on non-scrollable widget',
          (WidgetTester tester) async {
        final scrollEvents = <ScrollData>[];

        await tester.pumpWidget(createTestWidget(
          onScroll: (data) => scrollEvents.add(data),
          child: SizedBox(
            width: 200,
            height: 200,
            child: const Text('Non-scrollable'),
          ),
        ));

        // Try to scroll
        await tester.drag(find.byType(SizedBox), const Offset(0, -100));
        await tester.pump();

        expect(scrollEvents, isEmpty);
      });

      testWidgets('should validate scroll direction against scroll axis',
          (WidgetTester tester) async {
        final scrollEvents = <ScrollData>[];

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: MsrGestureDetector(
              onClick: (data) {},
              onLongClick: (data) {},
              onScroll: (data) => scrollEvents.add(data),
              child: SizedBox(
                height: 200,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: List.generate(
                    20,
                    (index) => SizedBox(
                      width: 100,
                      child: Text('Item $index'),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ));

        // Try vertical scroll on horizontal ListView
        await tester.drag(find.byType(ListView), const Offset(0, -100));
        await tester.pump();

        expect(scrollEvents, isEmpty); // Should not detect invalid scroll
      });
    });

    group('Edge Cases and Error Handling', () {
      testWidgets('should handle pointer cancel events',
          (WidgetTester tester) async {
        final clickEvents = <ClickData>[];
        final longClickEvents = <LongClickData>[];
        final scrollEvents = <ScrollData>[];

        await tester.pumpWidget(createTestWidget(
          onClick: (data) => clickEvents.add(data),
          onLongClick: (data) => longClickEvents.add(data),
          onScroll: (data) => scrollEvents.add(data),
        ));

        // Start a gesture
        final gesture = await tester
            .startGesture(tester.getCenter(find.byType(ElevatedButton)));

        // Cancel the gesture
        await gesture.cancel();
        await tester.pump();

        expect(clickEvents, isEmpty);
        expect(longClickEvents, isEmpty);
        expect(scrollEvents, isEmpty);
      });

      testWidgets('should handle multiple pointers correctly',
          (WidgetTester tester) async {
        final clickEvents = <ClickData>[];

        await tester.pumpWidget(createTestWidget(
          onClick: (data) => clickEvents.add(data),
        ));

        // Start first gesture
        final gesture1 = await tester
            .startGesture(tester.getCenter(find.byType(ElevatedButton)));

        // Start second gesture (different pointer)
        final gesture2 = await tester.startGesture(
          tester.getCenter(find.byType(ElevatedButton)) + const Offset(10, 10),
        );

        // Release first gesture
        await gesture1.up();
        await tester.pump();

        // Release second gesture
        await gesture2.up();
        await tester.pump();

        // Should only register one click (from the tracked pointer)
        expect(clickEvents, hasLength(1));
      });

      testWidgets('should handle exceptions gracefully',
          (WidgetTester tester) async {
        bool exceptionThrown = false;

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: MsrGestureDetector(
              onClick: (data) {
                throw Exception('Test exception');
              },
              onLongClick: (data) {},
              onScroll: (data) {},
              child: ElevatedButton(
                onPressed: () {},
                child: const Text('Test Button'),
              ),
            ),
          ),
        ));

        // This should not crash the app
        try {
          await tester.tap(find.byType(ElevatedButton));
          await tester.pump();
        } catch (e) {
          exceptionThrown = true;
        }

        // The exception should be handled internally
        expect(exceptionThrown, isFalse);
      });

      testWidgets('should handle widgets without render objects',
          (WidgetTester tester) async {
        final clickEvents = <ClickData>[];

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: MsrGestureDetector(
              onClick: (data) => clickEvents.add(data),
              onLongClick: (data) {},
              onScroll: (data) {},
              child: const SizedBox.shrink(),
            ),
          ),
        ));

        // Try to tap on the empty widget
        await tester.tap(find.byType(SizedBox));
        await tester.pump();

        expect(clickEvents, isEmpty);
      });
    });

    group('Label Extraction', () {
      testWidgets('should extract labels from different widget types',
          (WidgetTester tester) async {
        final clickEvents = <ClickData>[];

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: MsrGestureDetector(
              onClick: (data) => clickEvents.add(data),
              onLongClick: (data) {},
              onScroll: (data) {},
              child: Column(
                children: [
                  // Wrap each widget to isolate them properly
                  SizedBox(
                    height: 60,
                    child: const ListTile(title: Text('ListTile Label')),
                  ),
                  SizedBox(
                    height: 60,
                    child: Tooltip(
                      message: 'Tooltip Message',
                      child: IconButton(
                        onPressed: () {},
                        icon: const Icon(Icons.info),
                      ),
                    ),
                  ),
                  SizedBox(
                    height: 60,
                    child: ElevatedButton(
                      onPressed: () {},
                      child: const Text('Button Label'),
                    ),
                  ),
                  // For testing semantic labels, use a clickable widget
                  SizedBox(
                    height: 60,
                    child: InkWell(
                      key: ValueKey('InkWell'),
                      onTap: () {},
                      child: const Icon(Icons.star),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ));

        // Clear any initial events
        clickEvents.clear();

        await tester.tap(find.byType(ListTile));
        await tester.pump();
        expect(clickEvents, hasLength(1));
        expect(clickEvents.last.targetId, 'ListTile Label');

        // Test Button with text label
        await tester.tap(find.byType(ElevatedButton));
        await tester.pump();
        expect(clickEvents, hasLength(2));
        expect(clickEvents.last.targetId, 'Button Label');

        // Test InkWell with Icon
        await tester.tap(find.byKey(ValueKey("InkWell")));
        await tester.pump();
        expect(clickEvents, hasLength(3));
        expect(clickEvents.last.targetId, null);
      });

      testWidgets('should handle null labels gracefully',
          (WidgetTester tester) async {
        final clickEvents = <ClickData>[];

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: MsrGestureDetector(
              onClick: (data) => clickEvents.add(data),
              onLongClick: (data) {},
              onScroll: (data) {},
              child: IconButton(
                onPressed: () {},
                icon: const Icon(Icons.add),
              ),
            ),
          ),
        ));

        await tester.tap(find.byType(IconButton));
        await tester.pump();

        expect(clickEvents, hasLength(1));
        expect(clickEvents.first.targetId, isNull);
      });
    });

    group('Coordinates calculation', () {
      testWidgets('should calculate x, y, endX, endY coordinates correctly for scroll',
              (WidgetTester tester) async {
            final scrollEvents = <ScrollData>[];

            // Set up a test environment with known device pixel ratio
            await tester.binding.setSurfaceSize(const Size(400, 600));
            await tester.pumpWidget(
              MaterialApp(
                home: Scaffold(
                  body: MsrGestureDetector(
                    onClick: (data) {},
                    onLongClick: (data) {},
                    onScroll: (data) => scrollEvents.add(data),
                    child: SizedBox(
                      height: 300,
                      child: ListView(
                        children: List.generate(
                          20,
                              (index) => ListTile(title: Text('Item $index')),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );

            // Get the device pixel ratio for calculations
            final devicePixelRatio = tester.view.devicePixelRatio;

            // Define start and end positions for the scroll gesture
            const startPosition = Offset(200, 250); // Start at center of ListView
            const endPosition = Offset(200, 150);   // End 100 pixels up
            const scrollDelta = Offset(0, -100);    // Upward scroll

            // Perform the scroll gesture
            await tester.dragFrom(startPosition, scrollDelta);
            await tester.pump();

            // Verify that scroll event was captured
            expect(scrollEvents, hasLength(1));

            final scrollEvent = scrollEvents.first;

            // Verify target and direction
            expect(scrollEvent.target, 'ListView');
            expect(scrollEvent.direction, MsrScrollDirection.up);

            // Verify coordinate calculations
            // x and y should be the start position (where touch began) multiplied by device pixel ratio
            expect(scrollEvent.x, equals((startPosition.dx * devicePixelRatio).roundToDouble()));
            expect(scrollEvent.y, equals((startPosition.dy * devicePixelRatio).roundToDouble()));

            // endX and endY should be the end position (where touch ended) multiplied by device pixel ratio
            expect(scrollEvent.endX, equals((endPosition.dx * devicePixelRatio).roundToDouble()));
            expect(scrollEvent.endY, equals((endPosition.dy * devicePixelRatio).roundToDouble()));

            // Verify that end coordinates are different from start coordinates (confirming scroll occurred)
            expect(scrollEvent.endY, lessThan(scrollEvent.y)); // End Y should be less than start Y for upward scroll
            expect(scrollEvent.endX, equals(scrollEvent.x)); // X should remain the same for vertical scroll
          });

      testWidgets('should calculate coordinates correctly for horizontal scroll',
              (WidgetTester tester) async {
            final scrollEvents = <ScrollData>[];

            await tester.binding.setSurfaceSize(const Size(400, 600));
            await tester.pumpWidget(
              MaterialApp(
                home: Scaffold(
                  body: MsrGestureDetector(
                    onClick: (data) {},
                    onLongClick: (data) {},
                    onScroll: (data) => scrollEvents.add(data),
                    child: SizedBox(
                      height: 200,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: List.generate(
                          20,
                              (index) => SizedBox(
                            width: 100,
                            child: ListTile(title: Text('Item $index')),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );

            final devicePixelRatio = tester.view.devicePixelRatio;

            // Define positions for horizontal scroll
            const startPosition = Offset(200, 100);
            const endPosition = Offset(100, 100);  // Move 100 pixels left
            const scrollDelta = Offset(-100, 0);   // Leftward scroll

            // Perform horizontal scroll
            await tester.dragFrom(startPosition, scrollDelta);
            await tester.pump();

            expect(scrollEvents, hasLength(1));

            final scrollEvent = scrollEvents.first;

            // Verify horizontal scroll direction
            expect(scrollEvent.direction, MsrScrollDirection.left);

            // Verify coordinate calculations for horizontal scroll
            expect(scrollEvent.x, equals((startPosition.dx * devicePixelRatio).roundToDouble()));
            expect(scrollEvent.y, equals((startPosition.dy * devicePixelRatio).roundToDouble()));
            expect(scrollEvent.endX, equals((endPosition.dx * devicePixelRatio).roundToDouble()));
            expect(scrollEvent.endY, equals((endPosition.dy * devicePixelRatio).roundToDouble()));

            // Verify that end coordinates reflect the horizontal movement
            expect(scrollEvent.endX, lessThan(scrollEvent.x)); // End X should be less than start X for leftward scroll
            expect(scrollEvent.endY, equals(scrollEvent.y)); // Y should remain the same for horizontal scroll
          });

      testWidgets('should handle device pixel ratio scaling in coordinate calculations',
              (WidgetTester tester) async {
            final scrollEvents = <ScrollData>[];

            // Set a custom device pixel ratio for testing
            await tester.binding.setSurfaceSize(const Size(400, 600));
            tester.view.devicePixelRatio = 2.0;

            await tester.pumpWidget(
              MaterialApp(
                home: Scaffold(
                  body: MsrGestureDetector(
                    onClick: (data) {},
                    onLongClick: (data) {},
                    onScroll: (data) => scrollEvents.add(data),
                    child: SizedBox(
                      height: 300,
                      child: ListView(
                        children: List.generate(10, (index) => ListTile(title: Text('Item $index'))),
                      ),
                    ),
                  ),
                ),
              ),
            );

            const startPosition = Offset(100, 200);
            const scrollDelta = Offset(0, -50);

            await tester.dragFrom(startPosition, scrollDelta);
            await tester.pump();

            expect(scrollEvents, hasLength(1));

            final scrollEvent = scrollEvents.first;

            // With device pixel ratio of 2.0, coordinates should be doubled
            expect(scrollEvent.x, equals(200.0)); // 100 * 2.0
            expect(scrollEvent.y, equals(400.0)); // 200 * 2.0
            expect(scrollEvent.endX, equals(200.0)); // 100 * 2.0
            expect(scrollEvent.endY, equals(300.0)); // 150 * 2.0

            // Clean up
            tester.view.devicePixelRatio = 1;
          });
    });
  });
}

// Helper class to create pointer events with custom timestamps
class TestPointerEvent {
  static PointerDownEvent createDownEvent({
    required Offset position,
    required Duration timeStamp,
    int pointer = 1,
  }) {
    return PointerDownEvent(
      pointer: pointer,
      position: position,
      timeStamp: timeStamp,
    );
  }

  static PointerUpEvent createUpEvent({
    required Offset position,
    required Duration timeStamp,
    int pointer = 1,
  }) {
    return PointerUpEvent(
      pointer: pointer,
      position: position,
      timeStamp: timeStamp,
    );
  }
}
