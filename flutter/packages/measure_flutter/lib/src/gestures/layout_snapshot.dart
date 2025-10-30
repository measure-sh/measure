/// Represents a single layout node in the widget tree
/// which can have nested children.
class SnapshotNode {
  final String label;
  final double x;
  final double y;
  final double width;
  final double height;
  final String? id;
  final bool highlighted;
  final bool scrollable;
  final List<SnapshotNode> children;

  SnapshotNode({
    this.id,
    this.highlighted = false,
    this.scrollable = false,
    required this.label,
    required this.x,
    required this.y,
    required this.width,
    required this.height,
    required this.children,
  });

  Map<String, dynamic> toJson() {
    final json = {
      'label': label,
      'x': x,
      'y': y,
      'width': width,
      'height': height,
    };

    if (highlighted) {
      json['highlighted'] = highlighted;
    }

    if (scrollable) {
      json['scrollable'] = scrollable;
    }

    if (id != null) {
      json['id'] = id!;
    }
    if (children.isNotEmpty) {
      json['children'] = children.map((c) => c.toJson()).toList();
    }
    return json;
  }
}
