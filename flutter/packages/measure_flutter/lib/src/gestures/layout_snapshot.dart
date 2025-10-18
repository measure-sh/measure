
/// Represents a single layout node in the widget tree
/// which can have nested children.
class LayoutSnapshot {
  final String widgetName;
  final double x;
  final double y;
  final double width;
  final double height;
  final String? id;
  final bool highlighted;
  final bool scrollable;
  final List<LayoutSnapshot> children;

  LayoutSnapshot({
    required this.widgetName,
    required this.x,
    required this.y,
    required this.width,
    required this.height,
    this.id,
    this.highlighted = false,
    this.scrollable = false,
    required this.children,
  });

  Map<String, dynamic> toJson() {
    final json = {
      'lb': widgetName,
      'x': x,
      'y': y,
      'wd': width,
      'ht': height,
      'hl': highlighted,
      'sc': scrollable,
    };
    if (id != null) {
      json['id'] = id!;
    }
    if (children.isNotEmpty) {
      json['ch'] = children.map((c) => c.toJson()).toList();
    }
    return json;
  }
}