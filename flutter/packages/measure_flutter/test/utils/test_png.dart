import 'dart:typed_data';

import 'package:image/image.dart' as img;

Uint8List createTestPngBytes() {
  // Create a simple 1x1 red pixel PNG
  final image = img.Image(width: 1, height: 1);
  img.fill(image, color: img.ColorRgb8(255, 0, 0));
  return Uint8List.fromList(img.encodePng(image));
}
