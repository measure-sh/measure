// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'snapshot_node.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SnapshotNode _$SnapshotNodeFromJson(Map<String, dynamic> json) => SnapshotNode(
      highlighted: json['highlighted'] as bool? ?? false,
      scrollable: json['scrollable'] as bool? ?? false,
      type: json['type'] as String? ?? "container",
      label: json['label'] as String,
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
      width: (json['width'] as num).toDouble(),
      height: (json['height'] as num).toDouble(),
      children: (json['children'] as List<dynamic>)
          .map((e) => SnapshotNode.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$SnapshotNodeToJson(SnapshotNode instance) =>
    <String, dynamic>{
      'label': instance.label,
      'type': instance.type,
      'x': instance.x,
      'y': instance.y,
      'width': instance.width,
      'height': instance.height,
      'highlighted': instance.highlighted,
      'scrollable': instance.scrollable,
      'children': instance.children,
    };
