import 'dart:developer';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../measure_flutter.dart';
import 'layout_snapshot_widget_filters.dart';

enum GestureDetectionMode {
  /// Detect clicked or long clicked element
  click,

  /// Detect scrolled element
  scroll,
}

/// Result of capturing a layout snapshot
/// with optional detected element info
class LayoutSnapshotCaptureResult {
  final SnapshotNode snapshot;
  final Element? gestureElement;
  final String? gestureElementType;

  LayoutSnapshotCaptureResult({
    required this.snapshot,
    this.gestureElement,
    this.gestureElementType,
  });
}

/// State for tracking information during tree capture
class _CaptureState {
  final Rect? screenBounds;
  final Offset? detectionPosition;
  final GestureDetectionMode? detectionMode;
  final Element rootElement;
  final Map<Type, String>? widgetFilter;
  Element? gestureElement;
  String? gestureElementType;
  String? gestureElementLabel;

  _CaptureState({
    required this.rootElement,
    this.screenBounds,
    this.detectionPosition,
    this.detectionMode,
    this.widgetFilter,
  });
}

/// Captures the layout snapshot starting from a given element.
class LayoutSnapshotCapture {
  /// Captures a hierarchical snapshot of the widget tree starting from [rootElement].
  ///
  /// If [screenBounds] is provided, only widgets within the bounds are included.
  ///
  /// If [detectionPosition] and [detectionMode] are provided, then it detects
  /// and "highlights" the widget at that position. The detected element is returned
  /// in [LayoutSnapshotCaptureResult.gestureElement].
  ///
  /// The [LayoutSnapshotCaptureResult.gestureElementType] is the deobfuscated type
  /// of the widget, it's preferable to use than instead of [gestureElement].
  ///
  /// The [widgetFilter] map specifies which widget types to include. When null or
  /// empty, a default set of framework widgets is used.
  ///
  /// Returns null if [rootElement] is null or has no valid render box.
  ///
  /// See also:
  ///
  ///  * [GestureDetectionMode], which specifies click or scroll detection.
  ///  * [SnapshotNode], the tree node structure returned.
  static LayoutSnapshotCaptureResult? capture(
    Element? rootElement, {
    Rect? screenBounds,
    Offset? detectionPosition,
    GestureDetectionMode? detectionMode,
    Map<Type, String>? widgetFilter,
  }) {
    Timeline.startSync('msr-layoutSnapshot-capture');
    try {
      if (rootElement == null || !_hasValidRenderBox(rootElement)) {
        return null;
      }
      final state = _initState(rootElement, screenBounds, detectionPosition, detectionMode, widgetFilter);
      final snapshot = _traverseNodesRecursively(rootElement, state);
      return LayoutSnapshotCaptureResult(
        snapshot: snapshot.last,
        gestureElement: state.gestureElement,
        gestureElementType: state.gestureElementType,
      );
    } finally {
      Timeline.finishSync();
    }
  }

  static bool _hitTest(Element element, Offset position, Element rootElement) {
    Timeline.startSync('msr-layoutSnapshot-hitTest');
    try {
      final renderObject = element.renderObject;
      if (renderObject == null || (renderObject is RenderBox && !renderObject.hasSize)) {
        return false;
      }
      final transform = renderObject.getTransformTo(rootElement.renderObject);
      final transformedBounds = MatrixUtils.transformRect(transform, renderObject.paintBounds);
      return transformedBounds.contains(position);
    } finally {
      Timeline.finishSync();
    }
  }

  static String? _getUserProvidedWidget(Widget widget, Map<Type, String>? providedWidgets) {
    return providedWidgets?[widget.runtimeType];
  }

  /// Checks if an element has a valid RenderBox with size
  static bool _hasValidRenderBox(Element element) {
    final renderObject = element.renderObject;
    return renderObject != null && renderObject is RenderBox && renderObject.hasSize;
  }

  static _CaptureState _initState(Element rootElement, Rect? screenBounds, Offset? detectionPosition,
      GestureDetectionMode? detectionMode, Map<Type, String>? widgetFilter) {
    return _CaptureState(
      rootElement: rootElement,
      screenBounds: screenBounds,
      detectionPosition: detectionPosition,
      detectionMode: detectionMode,
      widgetFilter: widgetFilter,
    );
  }

  static List<SnapshotNode> _traverseNodesRecursively(
    Element element,
    _CaptureState state, {
    bool skipHitTest = false,
  }) {
    final List<SnapshotNode> allChildren = [];
    final renderObject = element.renderObject;

    if (!_hasValidRenderBox(element)) {
      final List<SnapshotNode> promotedChildren = [];
      element.visitChildElements((child) {
        promotedChildren.addAll(_traverseNodesRecursively(
          child,
          state,
          skipHitTest: skipHitTest,
        ));
      });
      return promotedChildren;
    }

    if (renderObject is! RenderBox) {
      final List<SnapshotNode> promotedChildren = [];
      element.visitChildElements((child) {
        promotedChildren.addAll(_traverseNodesRecursively(
          child,
          state,
          skipHitTest: skipHitTest,
        ));
      });
      return promotedChildren;
    }

    var isVisible = true;
    if (element.widget is Visibility) {
      final visibility = element.widget as Visibility;
      if (!visibility.visible) {
        isVisible = false;
      }
    }

    if (element.widget is Opacity) {
      final opacity = element.widget as Opacity;
      if (opacity.opacity == 0) {
        isVisible = false;
      }
    }

    if (element.widget is Offstage) {
      final offstage = element.widget as Offstage;
      if (offstage.offstage == true) {
        isVisible = false;
      }
    }

    final bounds = _getBounds(renderObject);
    final isInScreenBounds = _isInScreenBounds(bounds, state.screenBounds);
    final matchedType =
        _getUserProvidedWidget(element.widget, state.widgetFilter) ?? getFrameworkWidgetName(element.widget);

    if (isVisible) {
      var skipHitTestForChildren = skipHitTest;
      if (!skipHitTest && state.detectionPosition != null && state.detectionMode != null) {
        final hitTestPassed = _updateGestureElementIfMatch(element, state);
        skipHitTestForChildren = !hitTestPassed;
      }

      element.visitChildElements((child) {
        allChildren.addAll(_traverseNodesRecursively(
          child,
          state,
          skipHitTest: skipHitTestForChildren,
        ));
      });

      final isGestureElement = state.gestureElement == element;

      if (isGestureElement || (isInScreenBounds && matchedType != null)) {
        return [_createNode(element, state, allChildren, isGestureElement, matchedType, bounds)];
      }
    }

    return allChildren;
  }

  /// Checks if this element matches the hit test and updates state.
  /// Returns true if hit test passed (position is within element bounds).
  static bool _updateGestureElementIfMatch(Element element, _CaptureState state) {
    if (!_hitTest(element, state.detectionPosition!, state.rootElement)) {
      return false;
    }

    final widgetType = state.detectionMode == GestureDetectionMode.click
        ? getClickableWidgetName(element.widget)
        : getScrollableWidgetName(element.widget);

    if (widgetType == null) {
      return true;
    }

    // Keep updating elements higher in z-order, which
    // is the last update wins.
    state.gestureElement = element;
    state.gestureElementType = widgetType;
    state.gestureElementLabel = widgetType;
    return true;
  }

  /// Checks if bounds are within screen bounds
  static bool _isInScreenBounds(Rect bounds, Rect? screenBounds) {
    if (screenBounds == null) return true;
    return screenBounds.overlaps(bounds);
  }

  static Rect _getBounds(RenderBox renderBox) {
    if (!renderBox.hasSize) {
      return Rect.zero;
    }

    try {
      final offset = renderBox.localToGlobal(Offset.zero);
      final size = renderBox.size;
      return Rect.fromLTWH(offset.dx, offset.dy, size.width, size.height);
    } catch (e) {
      return Rect.zero;
    }
  }

  /// Creates a [SnapshotNode] from an element with its children
  static SnapshotNode _createNode(
      Element element, _CaptureState state, List<SnapshotNode> children, bool isGestureElement, String? widgetName, Rect bounds) {
    final isScrollable = getScrollableWidgetName(element.widget) != null;
    final elementType = getWidgetElementType(element.widget);
    String label = widgetName ?? element.widget.runtimeType.toString();
    return SnapshotNode(
      label: label,
      type: elementType,
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height,
      highlighted: isGestureElement,
      scrollable: isScrollable,
      children: children,
    );
  }
}
