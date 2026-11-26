import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/config/screenshot_mask_level.dart';
import 'package:measure_flutter/src/screenshot/screenshot_mask.dart';

/// Keys for the widgets under test. Created fresh per test so reused
/// [GlobalKey]s don't leave stale render objects between pumps.
class _Keys {
  final boundary = GlobalKey();
  final text = GlobalKey();
  final buttonText = GlobalKey();
  final image = GlobalKey();
  final icon = GlobalKey();
  final field = GlobalKey();
  final passwordField = GlobalKey();
}

void main() {
  Future<_Keys> pumpTree(WidgetTester tester) async {
    final keys = _Keys();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RepaintBoundary(
            key: keys.boundary,
            child: Column(
              children: [
                Text('plain text', key: keys.text),
                ElevatedButton(
                  onPressed: () {},
                  child: Text('button', key: keys.buttonText),
                ),
                // A null-image RawImage yields a deterministic 50x50
                // RenderImage (what masking detects) with no async decode.
                RawImage(key: keys.image, width: 50, height: 50),
                Icon(Icons.chevron_right, key: keys.icon),
                SizedBox(width: 200, child: TextField(key: keys.field)),
                SizedBox(
                  width: 200,
                  child: TextField(key: keys.passwordField, obscureText: true),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    return keys;
  }

  /// Whether a masked rect lies within the bounds of the widget with [key].
  bool masks(WidgetTester tester, _Keys keys, List<Rect> rects, Key key) {
    final boundary =
        keys.boundary.currentContext!.findRenderObject() as RenderBox;
    final box = tester.renderObject<RenderBox>(find.byKey(key));
    final bounds =
        MatrixUtils.transformRect(box.getTransformTo(boundary), box.paintBounds)
            .inflate(1);
    return rects.any((rect) =>
        bounds.contains(rect.topLeft) && bounds.contains(rect.bottomRight));
  }

  List<Rect> findRects(_Keys keys, ScreenshotMaskLevel level) {
    return ScreenshotMask().findRectsToMask(
      keys.boundary.currentContext!.findRenderObject() as RenderRepaintBoundary,
      keys.boundary.currentContext! as Element,
      level,
    );
  }

  group('ScreenshotMask', () {
    testWidgets('allTextAndMedia masks text, fields and images',
        (tester) async {
      final keys = await pumpTree(tester);
      final rects = findRects(keys, ScreenshotMaskLevel.allTextAndMedia);

      expect(masks(tester, keys, rects, keys.text), isTrue);
      expect(masks(tester, keys, rects, keys.buttonText), isTrue);
      expect(masks(tester, keys, rects, keys.image), isTrue);
      expect(masks(tester, keys, rects, keys.icon), isTrue);
      expect(masks(tester, keys, rects, keys.field), isTrue);
      expect(masks(tester, keys, rects, keys.passwordField), isTrue);
    });

    testWidgets('allText masks text and fields but not images or icons',
        (tester) async {
      final keys = await pumpTree(tester);
      final rects = findRects(keys, ScreenshotMaskLevel.allText);

      expect(masks(tester, keys, rects, keys.text), isTrue);
      expect(masks(tester, keys, rects, keys.field), isTrue);
      expect(masks(tester, keys, rects, keys.image), isFalse);
      expect(masks(tester, keys, rects, keys.icon), isFalse);
    });

    testWidgets(
        'allTextExceptClickable skips clickable text but masks sensitive fields',
        (tester) async {
      final keys = await pumpTree(tester);
      final rects = findRects(keys, ScreenshotMaskLevel.allTextExceptClickable);

      expect(masks(tester, keys, rects, keys.text), isTrue);
      expect(masks(tester, keys, rects, keys.icon), isFalse);
      expect(masks(tester, keys, rects, keys.buttonText), isFalse);
      expect(masks(tester, keys, rects, keys.field), isFalse);
      expect(masks(tester, keys, rects, keys.passwordField), isTrue);
    });

    testWidgets('sensitiveFieldsOnly masks only sensitive fields',
        (tester) async {
      final keys = await pumpTree(tester);
      final rects = findRects(keys, ScreenshotMaskLevel.sensitiveFieldsOnly);

      expect(masks(tester, keys, rects, keys.passwordField), isTrue);
      expect(masks(tester, keys, rects, keys.field), isFalse);
      expect(masks(tester, keys, rects, keys.text), isFalse);
    });

    testWidgets('MsrMask masks wrapped content at every level', (tester) async {
      final boundaryKey = GlobalKey();
      final wrappedKey = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RepaintBoundary(
              key: boundaryKey,
              child: MsrMask(
                child: SizedBox(
                  key: wrappedKey,
                  width: 100,
                  height: 40,
                  child: const ColoredBox(color: Colors.blue),
                ),
              ),
            ),
          ),
        ),
      );

      final boundary = boundaryKey.currentContext!.findRenderObject()
          as RenderRepaintBoundary;
      final rects = ScreenshotMask().findRectsToMask(
        boundary,
        boundaryKey.currentContext! as Element,
        ScreenshotMaskLevel.sensitiveFieldsOnly,
      );

      final box = tester.renderObject<RenderBox>(find.byKey(wrappedKey));
      final bounds = MatrixUtils.transformRect(
          box.getTransformTo(boundary), box.paintBounds);
      expect(rects.any((rect) => bounds.contains(rect.center)), isTrue);
    });

    testWidgets('masks text inside ExcludeSemantics', (tester) async {
      final boundaryKey = GlobalKey();
      final textKey = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RepaintBoundary(
              key: boundaryKey,
              child: ExcludeSemantics(
                child: Text('masked text', key: textKey),
              ),
            ),
          ),
        ),
      );

      final boundary = boundaryKey.currentContext!.findRenderObject()
          as RenderRepaintBoundary;
      final rects = ScreenshotMask().findRectsToMask(
        boundary,
        boundaryKey.currentContext! as Element,
        ScreenshotMaskLevel.allText,
      );

      final text = tester.renderObject<RenderBox>(find.byKey(textKey));
      final bounds = MatrixUtils.transformRect(
          text.getTransformTo(boundary), text.paintBounds);
      expect(rects.any((rect) => bounds.contains(rect.center)), isTrue);
    });

    testWidgets('MsrMask inside ExcludeSemantics is masked at every level',
        (tester) async {
      final boundaryKey = GlobalKey();
      final wrappedKey = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RepaintBoundary(
              key: boundaryKey,
              child: ExcludeSemantics(
                child: MsrMask(
                  child: SizedBox(
                    key: wrappedKey,
                    width: 100,
                    height: 40,
                    child: const ColoredBox(color: Colors.blue),
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      final boundary = boundaryKey.currentContext!.findRenderObject()
          as RenderRepaintBoundary;
      final rects = ScreenshotMask().findRectsToMask(
        boundary,
        boundaryKey.currentContext! as Element,
        ScreenshotMaskLevel.sensitiveFieldsOnly,
      );

      final box = tester.renderObject<RenderBox>(find.byKey(wrappedKey));
      final bounds = MatrixUtils.transformRect(
          box.getTransformTo(boundary), box.paintBounds);
      expect(rects.any((rect) => bounds.contains(rect.center)), isTrue);
    });
  });
}
