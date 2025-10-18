// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'msr_attachment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MsrAttachment _$MsrAttachmentFromJson(Map<String, dynamic> json) =>
    MsrAttachment(
      name: json['name'] as String,
      id: json['id'] as String,
      type: $enumDecode(_$AttachmentTypeEnumMap, json['type']),
      size: (json['size'] as num).toInt(),
      path: json['path'] as String?,
    );

Map<String, dynamic> _$MsrAttachmentToJson(MsrAttachment instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': _$AttachmentTypeEnumMap[instance.type]!,
      'name': instance.name,
      'size': instance.size,
      'path': instance.path,
    };

const _$AttachmentTypeEnumMap = {
  AttachmentType.screenshot: 'screenshot',
  AttachmentType.layoutSnapshotJson: 'layout_snapshot_json',
};
