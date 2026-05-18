import 'dart:typed_data';

import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/events/attachment_bytes_format.dart';

part 'msr_attachment.g.dart';

/// Represents a file attachment that can be included with bug reports or events.
///
/// [MsrAttachment] encapsulates file data, metadata, and type information
/// for attachments like screenshots, logs, or user-selected files.
///
/// Use [Measure.captureScreenshot] to easily capture a screenshot and convert
/// it to an attachment.
@JsonSerializable()
class MsrAttachment {
  final String id;
  final AttachmentType type;
  final String name;
  final int size;
  final String? path;

  @JsonKey(includeFromJson: false, includeToJson: false)
  final Uint8List? bytes;

  @JsonKey(includeFromJson: false, includeToJson: false)
  final AttachmentBytesFormat? bytesFormat;

  /// Pixel width of [bytes]. Set only for raw-pixel attachments produced
  /// internally by the screenshot collector.
  @JsonKey(includeFromJson: false, includeToJson: false)
  final int? width;

  /// Pixel height of [bytes]. Set only for raw-pixel attachments produced
  /// internally by the screenshot collector.
  @JsonKey(includeFromJson: false, includeToJson: false)
  final int? height;

  MsrAttachment({
    required this.name,
    required this.id,
    required this.type,
    required this.size,
    this.path,
    this.bytes,
    this.bytesFormat,
    this.width,
    this.height,
  })  : assert(bytes == null || bytesFormat != null,
            'bytesFormat is required whenever bytes is non-null'),
        assert(
            bytesFormat != AttachmentBytesFormat.rawRgba8888 ||
                (width != null && height != null),
            'rawRgba8888 attachments require width and height');

  bool get hasRawPixels =>
      bytes != null && bytesFormat == AttachmentBytesFormat.rawRgba8888;

  /// Creates an [MsrAttachment] from encoded image bytes (PNG/JPEG/WebP/etc.).
  ///
  /// Use this factory when you have file content as bytes, such as a
  /// downloaded file. For screenshots, prefer [Measure.captureScreenshot].
  ///
  /// **Parameters:**
  /// - [bytes]: The encoded image bytes
  /// - [type]: The type of attachment (screenshot, image, etc.)
  /// - [uuid]: A unique identifier for this attachment
  factory MsrAttachment.fromBytes({
    required Uint8List bytes,
    required AttachmentType type,
    required String uuid,
  }) {
    return MsrAttachment(
      name: uuid,
      id: uuid,
      type: type,
      size: bytes.length,
      bytes: bytes,
      bytesFormat: AttachmentBytesFormat.encoded,
    );
  }

  /// Creates an [MsrAttachment] holding raw RGBA8888 pixels.
  ///
  /// Internal: used by the screenshot collector to defer WebP encoding to
  /// the native side. Not part of the public SDK surface.
  factory MsrAttachment.fromRawPixels({
    required Uint8List bytes,
    required int width,
    required int height,
    required AttachmentType type,
    required String uuid,
  }) {
    return MsrAttachment(
      name: uuid,
      id: uuid,
      type: type,
      size: bytes.length,
      bytes: bytes,
      bytesFormat: AttachmentBytesFormat.rawRgba8888,
      width: width,
      height: height,
    );
  }

  /// Creates an [MsrAttachment] from a file path.
  ///
  /// Use this factory when referencing an existing file on the filesystem.
  ///
  /// **Parameters:**
  /// - [path]: The file system path to the file
  /// - [type]: The type of attachment
  /// - [size]: The file size in bytes
  /// - [uuid]: A unique identifier for this attachment
  factory MsrAttachment.fromPath({
    required String path,
    required AttachmentType type,
    required int size,
    required String uuid,
  }) {
    return MsrAttachment(
      name: uuid,
      size: size,
      id: uuid,
      type: type,
      path: path,
    );
  }

  Map<String, dynamic> toJson() => _$MsrAttachmentToJson(this);

  factory MsrAttachment.fromJson(Map<String, dynamic> json) =>
      _$MsrAttachmentFromJson(json);

  @override
  String toString() {
    return 'MsrAttachment{id: $id, type: $type, name: $name, size: $size, path: $path, bytes: $bytes}';
  }
}

