import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter/src/bug_report/ui/image_picker.dart';

import 'fake_id_provider.dart';
import 'noop_logger.dart';

class FakeImagePickerWrapper extends ImagePickerWrapper {
  FakeImagePickerWrapper()
      : super(idProvider: FakeIdProvider(), logger: NoopLogger());

  Duration? delay;
  List<MsrAttachment> resultImages = [];

  @override
  Future<List<MsrAttachment>> pickImagesFromGallery(int limit) async {
    if (delay != null) {
      await Future.delayed(delay!);
    }
    return resultImages;
  }
}
