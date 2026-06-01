import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:measure_flutter/src/config/screenshot_mask_level.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_widget_filters.dart';
import 'package:measure_flutter/src/screenshot/msr_mask.dart';

/// Finds the regions of a captured screenshot that must be masked for privacy,
/// based on the configured [ScreenshotMaskLevel].
///
/// Walks the element tree under the screenshot [RepaintBoundary] (the same tree
/// walked by `LayoutSnapshotCapture`) and returns the rectangles, in the
/// boundary's local coordinates, that should be painted over.
class ScreenshotMask {
  /// Returns the regions to mask, in [boundary]-local coordinates.
  ///
  /// [rootElement] must be the element of [boundary]. The result is empty when
  /// nothing in the tree matches [level].
  List<Rect> findRectsToMask(
    RenderRepaintBoundary boundary,
    Element rootElement,
    ScreenshotMaskLevel level,
  ) {
    final rects = <Rect>[];
    final masked = <RenderObject>{};

    void visit(Element element, {required bool clickable}) {
      final renderObject = element.renderObject;
      if (_isHidden(renderObject)) return;

      final widget = element.widget;
      final isClickable = clickable || getClickableWidgetName(widget) != null;

      if (renderObject is RenderBox &&
          renderObject.hasSize &&
          _shouldMask(widget, renderObject, level, isClickable) &&
          masked.add(renderObject)) {
        final rect = MatrixUtils.transformRect(
          renderObject.getTransformTo(boundary),
          renderObject.paintBounds,
        );
        if (rect.overlaps(boundary.paintBounds)) {
          rects.add(rect);
        }
      }

      element.visitChildElements(
        (child) => visit(child, clickable: isClickable),
      );
    }

    visit(rootElement, clickable: false);
    return rects;
  }

  /// Whether the subtree at [renderObject] is not painted and can be skipped.
  bool _isHidden(RenderObject? renderObject) {
    if (renderObject is RenderOffstage) return renderObject.offstage;
    if (renderObject is RenderOpacity) return renderObject.opacity == 0;
    if (renderObject is RenderExcludeSemantics) return renderObject.excluding;
    return false;
  }

  bool _shouldMask(
    Widget widget,
    RenderBox renderObject,
    ScreenshotMaskLevel level,
    bool isClickable,
  ) {
    // Explicitly opted-in via MsrMask, masked at every level.
    if (widget is MsrMask) return true;

    final isText = renderObject is RenderParagraph;
    final isTextInput = widget is EditableText;
    final isMedia = renderObject is RenderImage;
    final isSensitive = isTextInput && _isSensitiveInput(widget);

    switch (level) {
      case ScreenshotMaskLevel.allTextAndMedia:
        return isText || isTextInput || isMedia;
      case ScreenshotMaskLevel.allText:
        return isText || isTextInput;
      case ScreenshotMaskLevel.allTextExceptClickable:
        // Sensitive fields are always masked, even when clickable.
        return isSensitive || ((isText || isTextInput) && !isClickable);
      case ScreenshotMaskLevel.sensitiveFieldsOnly:
        return isSensitive;
    }
  }

  bool _isSensitiveInput(EditableText widget) {
    return widget.obscureText ||
        widget.keyboardType == TextInputType.emailAddress ||
        widget.keyboardType == TextInputType.phone ||
        widget.keyboardType == TextInputType.visiblePassword;
  }
}
