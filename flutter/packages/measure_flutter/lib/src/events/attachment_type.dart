import 'package:json_annotation/json_annotation.dart';

enum AttachmentType {
  @JsonValue('screenshot')
  screenshot,
  @JsonValue('layout_snapshot_json')
  layoutSnapshotJson,
}
