import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/bug_report/ui/raw_rgba_image_provider.dart';
import 'package:measure_flutter/src/bug_report/ui/screenshot_list_item.dart';

void main() {
  group('ScreenshotListItem', () {
    Widget wrap(Widget child) => MaterialApp(
          home: Scaffold(
            body: SizedBox(width: 200, height: 200, child: child),
          ),
        );

    testWidgets(
        'renders raw RGBA bytes via RawRgbaImageProvider without codec error',
        (tester) async {
      const width = 4;
      const height = 4;
      final pixels = Uint8List(width * height * 4);
      for (var i = 0; i < pixels.length; i += 4) {
        pixels[i] = 255; // R
        pixels[i + 1] = 0; // G
        pixels[i + 2] = 0; // B
        pixels[i + 3] = 255; // A
      }

      final attachment = MsrAttachment.fromRawPixels(
        bytes: pixels,
        width: width,
        height: height,
        type: AttachmentType.screenshot,
        uuid: 'raw-rgba',
      );

      await tester.pumpWidget(wrap(
        ScreenshotListItem(screenshot: attachment, onDelete: () {}),
      ));
      await tester.pump();

      expect(tester.takeException(), isNull);
      final image = tester.widget<Image>(find.byType(Image));
      expect(image.image, isA<RawRgbaImageProvider>());
    });

    testWidgets('selects MemoryImage for encoded bytes', (tester) async {
      final attachment = MsrAttachment.fromBytes(
        bytes: _onePixelPng,
        type: AttachmentType.screenshot,
        uuid: 'encoded-png',
      );

      await tester.pumpWidget(wrap(
        ScreenshotListItem(screenshot: attachment, onDelete: () {}),
      ));
      // Avoid pumpAndSettle: image decoding completes via flutter_tester's
      // fake async, but the framework also schedules a 500ms AnimatedOpacity
      // that we don't care about here.
      await tester.pump();

      expect(tester.takeException(), isNull);
      final image = tester.widget<Image>(find.byType(Image));
      expect(image.image, isA<MemoryImage>());
    });
  });
}

/// 1x1 transparent PNG (smallest valid PNG, 67 bytes).
final Uint8List _onePixelPng = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
);
