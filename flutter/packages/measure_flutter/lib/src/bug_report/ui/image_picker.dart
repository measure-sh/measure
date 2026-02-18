import 'package:image_picker/image_picker.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';

import '../../utils/id_provider.dart';

class ImagePickerWrapper {
  final ImagePicker _picker = ImagePicker();
  final IdProvider _idProvider;
  final Logger _logger;

  ImagePickerWrapper({
    required IdProvider idProvider,
    required Logger logger,
  })  : _logger = logger,
        _idProvider = idProvider;

  Future<List<MsrAttachment>> pickImagesFromGallery(int limit) async {
    try {
      final List<XFile> images = await _pickImages();

      if (images.isEmpty) {
        return [];
      }

      final List<MsrAttachment> attachments = [];
      final imagesToProcess = images.take(limit).toList();

      for (XFile image in imagesToProcess) {
        final size = await image.length();
        final attachment = MsrAttachment.fromPath(
          path: image.path,
          type: AttachmentType.screenshot,
          size: size,
          uuid: _idProvider.uuid(),
        );
        attachments.add(attachment);
      }
      return attachments;
    } catch (e, stacktrace) {
      _logger.log(LogLevel.error, "Failed to pick image from gallery", e, stacktrace);
      return [];
    }
  }

  Future<List<XFile>> _pickImages() async {
    return await _pickMultipleImages();
  }

  Future<List<XFile>> _pickMultipleImages() async {
    return await _picker.pickMultiImage(
      imageQuality: 20,
    );
  }
}
