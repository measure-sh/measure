import 'package:json_annotation/json_annotation.dart';

part 'snapshot_node.g.dart';

/// Represents a single node in the layout snapshot
/// which can have nested children of the same type.
@JsonSerializable()
class SnapshotNode {
  final String label;
  final String type;
  final double x;
  final double y;
  final double width;
  final double height;
  @JsonKey(includeToJson: false)
  final String? id;
  final bool highlighted;
  final bool scrollable;
  final List<SnapshotNode> children;

  /// Creates a new [SnapshotNode].
  SnapshotNode({
    this.id,
    this.highlighted = false,
    this.scrollable = false,
    this.type = "container",
    required this.label,
    required this.x,
    required this.y,
    required this.width,
    required this.height,
    required this.children,
  });

  Map<String, dynamic> toJson() => _$SnapshotNodeToJson(this);

  static SnapshotNode fromJson(Map<String, dynamic> json) => _$SnapshotNodeFromJson(json);
}
