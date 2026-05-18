import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';

/// An [ImageProvider] for raw RGBA8888 pixel buffers.
///
/// [MemoryImage] cannot be used for raw pixels because it runs the bytes
/// through the platform image codec, which expects an encoded format
/// (PNG/JPEG/WebP/etc.) and fails on a bare pixel buffer.
class RawRgbaImageProvider extends ImageProvider<RawRgbaImageProvider> {
  RawRgbaImageProvider({
    required this.bytes,
    required this.width,
    required this.height,
    this.scale = 1.0,
  });

  final Uint8List bytes;
  final int width;
  final int height;
  final double scale;

  @override
  Future<RawRgbaImageProvider> obtainKey(ImageConfiguration configuration) {
    return SynchronousFuture<RawRgbaImageProvider>(this);
  }

  @override
  ImageStreamCompleter loadImage(
      RawRgbaImageProvider key, ImageDecoderCallback decode) {
    return MultiFrameImageStreamCompleter(
      codec: _loadCodec(),
      scale: key.scale,
      debugLabel: 'RawRgbaImageProvider(${width}x$height)',
    );
  }

  Future<ui.Codec> _loadCodec() async {
    final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
    final descriptor = ui.ImageDescriptor.raw(
      buffer,
      width: width,
      height: height,
      pixelFormat: ui.PixelFormat.rgba8888,
    );
    return descriptor.instantiateCodec();
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is RawRgbaImageProvider &&
        identical(other.bytes, bytes) &&
        other.width == width &&
        other.height == height &&
        other.scale == scale;
  }

  @override
  int get hashCode =>
      Object.hash(identityHashCode(bytes), width, height, scale);
}
