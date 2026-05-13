import 'dart:typed_data';

import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/screenshot/screenshot_collector.dart';

class FakeScreenshotCollector extends ScreenshotCollector {
  @override
  Future<MsrAttachment?> capture() async {
    // 1x1 raw RGBA pixel (red).
    final rgba = Uint8List.fromList(<int>[255, 0, 0, 255]);
    return MsrAttachment.fromRawPixels(
      bytes: rgba,
      width: 1,
      height: 1,
      type: AttachmentType.screenshot,
      uuid: "test-id",
    );
  }
}
