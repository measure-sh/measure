import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/screenshot/screenshot_collector.dart';

import 'test_png.dart';

class FakeScreenshotCollector extends ScreenshotCollector {
  @override
  Future<MsrAttachment?> capture() async {
    return MsrAttachment(
      name: "screenshot",
      id: "test-id",
      type: AttachmentType.screenshot,
      size: 100,
      bytes: createTestPngBytes(),
    );
  }
}
