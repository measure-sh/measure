import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_collector.dart';

class FakeLayoutSnapshotCollector implements LayoutSnapshotCollector {
  MsrAttachment? attachment;
  int captureCount = 0;

  FakeLayoutSnapshotCollector({this.attachment});

  @override
  Future<MsrAttachment?> captureAttachmentAfterNextFrame() async {
    captureCount++;
    return attachment;
  }

  @override
  Future<MsrAttachment?> createAttachment(SnapshotNode snapshot) async =>
      attachment;
}
