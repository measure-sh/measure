import 'dart:typed_data';

import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/measure_flutter.dart';

part 'msr_attachment.g.dart';

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
