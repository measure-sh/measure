import 'dart:typed_data';

import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/measure_flutter.dart';

part 'msr_attachment.g.dart';

/// Represents a file attachment that can be included with bug reports or events.
/// 
/// [MsrAttachment] encapsulates file data, metadata, and type information
/// for attachments like screenshots, logs, or user-selected files.
/// 
/// **Usage:**
/// ```dart
/// // Create from bytes (e.g., screenshot)
/// final screenshot = MsrAttachment.fromBytes(
///   bytes: screenshotData,
///   type: AttachmentType.screenshot,
///   uuid: 'screenshot-123',
/// );
/// 
/// // Create from file path
/// final logFile = MsrAttachment.fromPath(
///   path: '/path/to/log.txt',
///   type: AttachmentType.text,
///   size: 1024,
///   uuid: 'log-456',
/// );
/// 
/// // Include in bug report
/// Measure.instance.trackBugReport(
///   description: 'App crashed',
///   attachments: [screenshot, logFile],
///   attributes: {},
/// );
/// ```
@JsonSerializable()
class MsrAttachment {
  final String id;
  final AttachmentType type;
  final String name;
  final int size;
  final String? path;

  @JsonKey(includeFromJson: false, includeToJson: false)
  final Uint8List? bytes;

  MsrAttachment({
    required this.name,
    required this.id,
    required this.type,
    required this.size,
    this.path,
    this.bytes,
  });

  /// Creates an [MsrAttachment] from binary data.
  /// 
  /// Use this factory when you have file content as bytes, such as
  /// from a screenshot capture or downloaded file.
  /// 
  /// **Parameters:**
  /// - [bytes]: The binary file content
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
