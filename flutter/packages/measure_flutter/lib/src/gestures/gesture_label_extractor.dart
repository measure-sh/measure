import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

const int _labelMaxChars = 32;

/// The visible text and accessibility label captured for a clicked element.
class GestureLabels {
  final String? label;
  final String? semanticLabel;

  const GestureLabels(this.label, this.semanticLabel);

  static const GestureLabels empty = GestureLabels(null, null);
}

/// Extracts the gesture [GestureLabels] from the clicked [element]'s subtree.
///
/// The first visible [Text] found in tree order is captured and truncated.
/// Text from input fields ([EditableText], [TextField], [CupertinoTextField])
/// is never captured, and `MsrMask`-wrapped subtrees are skipped to honor the
/// same masking applied to screenshots.
GestureLabels extractGestureLabels(Element element) {
  String? label;
  String? semanticLabel;

  void visit(Element node) {
    if (label != null) {
      return;
    }

    final widget = node.widget;

    // Never capture text from input fields.
    if (widget is EditableText ||
        widget is TextField ||
        widget is CupertinoTextField) {
      return;
    }

    // Respect MsrMask. Detected by type name to avoid a hard dependency until the
    // widget lands; replace with `widget is MsrMask` once it is available.
    if (widget.runtimeType.toString() == 'MsrMask') {
      return;
    }

    semanticLabel ??= _semanticLabelOf(widget);

    if (widget is Text) {
      label = _normalize(widget.data ?? widget.textSpan?.toPlainText());
      return;
    }
    if (widget is RichText) {
      label = _normalize(widget.text.toPlainText());
      return;
    }

    node.visitChildElements(visit);
  }

  visit(element);

  return GestureLabels(
    label != null ? _truncate(label!) : null,
    semanticLabel != null ? _truncate(semanticLabel!) : null,
  );
}

String? _semanticLabelOf(Widget widget) {
  if (widget is Semantics) return _normalize(widget.properties.label);
  if (widget is Tooltip) return _normalize(widget.message);
  if (widget is Icon) return _normalize(widget.semanticLabel);
  if (widget is Image) return _normalize(widget.semanticLabel);
  return null;
}

String? _normalize(String? value) {
  if (value == null) return null;
  final collapsed = value.trim().replaceAll(RegExp(r'\s+'), ' ');
  if (collapsed.isEmpty) return null;
  // Icon-font / non-text glyphs render as a □ box; require a real letter or
  // digit so those are not captured as labels.
  if (!collapsed.contains(RegExp(r'[\p{L}\p{N}]', unicode: true))) {
    return null;
  }
  return collapsed;
}

String _truncate(String value) {
  if (value.length > _labelMaxChars) {
    return '${value.substring(0, _labelMaxChars - 1)}…';
  }
  return value;
}
