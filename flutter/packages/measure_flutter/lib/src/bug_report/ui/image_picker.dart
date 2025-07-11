import 'package:image_picker/image_picker.dart';
import 'package:measure_flutter/measure_flutter.dart';

import '../../logger/log_level.dart';
import '../../logger/logger.dart';
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
      final List<XFile> images = await _pickImages(limit);

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
      _logger.log(
          LogLevel.error, "Failed to pick image from gallery", e, stacktrace);
      return [];
    }
  }

  Future<List<XFile>> _pickImages(int remainingSlots) async {
    if (remainingSlots <= 0) return [];

    // There is a validation in the image picker which does not
    // allow using pickMultiImage with a limit of 1 image,
    // for which we need to use pickImage.
    return remainingSlots == 1
        ? await _pickSingleImage()
        : await _pickMultipleImages(remainingSlots);
  }

  Future<List<XFile>> _pickSingleImage() async {
    final image = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 20,
    );
    return image != null ? [image] : [];
  }

  Future<List<XFile>> _pickMultipleImages(int limit) async {
    return await _picker.pickMultiImage(
      imageQuality: 20,
      limit: limit,
    );
  }
}
