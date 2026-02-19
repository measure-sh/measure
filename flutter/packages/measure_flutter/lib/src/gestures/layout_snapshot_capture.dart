import 'dart:developer';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../measure_flutter.dart';
import 'layout_snapshot_widget_filters.dart';

enum GestureDetectionMode {
  /// Detect clicked or long clicked element
  click,

  /// Detect scrolled element
  scroll,
}

/// Result of capturing a layout snapshot with optional detected element info
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

  /// Flag set when BlockSemantics is encountered.
  /// Consumed at Overlay level to clear previously collected siblings.
  bool shouldClearSiblings = false;

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

      final state = _CaptureState(
        rootElement: rootElement,
        screenBounds: screenBounds,
        detectionPosition: detectionPosition,
        detectionMode: detectionMode,
        widgetFilter: widgetFilter,
      );

      final nodes = _recursiveTraverse(rootElement, state);
      if (nodes.isEmpty) {
        return null;
      }

      return LayoutSnapshotCaptureResult(
        snapshot: nodes.last,
        gestureElement: state.gestureElement,
        gestureElementType: state.gestureElementType,
      );
    } finally {
      Timeline.finishSync();
    }
  }

  /// Recursively traverses the element tree.
  ///
  /// Returns a list of SnapshotNodes. Usually contains 0 or 1 node.
  /// Multiple nodes returned when children are "promoted" (element has no RenderBox
  /// or doesn't match the widget filter).
  static List<SnapshotNode> _recursiveTraverse(
    Element element,
    _CaptureState state, {
    bool skipHitTest = false,
  }) {
    final renderObject = element.renderObject;

    // --- Visibility checks ---

    // BlockSemantics: signal to clear siblings at Overlay level
    if (renderObject is RenderBlockSemantics && renderObject.blocking) {
      state.shouldClearSiblings = true;
    }

    // ExcludeSemantics: skip entire subtree
    if (renderObject is RenderExcludeSemantics && renderObject.excluding) {
      return [];
    }

    // Offstage: skip entire subtree (not painted)
    if (renderObject is RenderOffstage && renderObject.offstage) {
      return [];
    }

    // Zero opacity: skip entire subtree (invisible)
    if (renderObject is RenderOpacity && renderObject.opacity == 0) {
      return [];
    }

    // --- Handle elements without valid RenderBox ---

    // Promote children if no valid RenderBox (e.g., ComponentElements)
    if (!_hasValidRenderBox(element) || renderObject is! RenderBox) {
      return _visitChildren(element, state, skipHitTest);
    }

    // --- Process element with valid RenderBox ---

    final bounds = _getBounds(renderObject);
    final isInScreenBounds = _isInScreenBounds(bounds, state.screenBounds);
    final matchedType = _getWidgetTypeName(element.widget, state.widgetFilter);

    // Hit testing for gesture detection
    var skipHitTestForChildren = skipHitTest;
    if (!skipHitTest && state.detectionPosition != null && state.detectionMode != null) {
      final hitTestPassed = _performHitTest(element, state);
      skipHitTestForChildren = !hitTestPassed;
    }

    // Recurse into children
    final children = _visitChildren(element, state, skipHitTestForChildren);

    final isGestureElement = state.gestureElement == element;

    // Create node if:
    // 1. Is within screen bounds
    // 2. This is the detected gesture element
    // 3. Widget matches filter
    if (isGestureElement || (isInScreenBounds && matchedType != null)) {
      return [_createNode(element, children, isGestureElement, matchedType, bounds)];
    }

    // Otherwise promote children
    return children;
  }

  /// Visits all children of an element.
  ///
  /// Handles BlockSemantics flag: when set and we're at the Overlay level,
  /// clear previously collected siblings.
  static List<SnapshotNode> _visitChildren(
    Element element,
    _CaptureState state,
    bool skipHitTest,
  ) {
    final List<SnapshotNode> children = [];

    element.visitChildElements((child) {
      // Traverse child subtree
      final childResults = _recursiveTraverse(child, state, skipHitTest: skipHitTest);

      // Handle BlockSemantics flag at the Overlay level
      if (state.shouldClearSiblings && _isOverlayLevel(element)) {
        // Clear everything collected before this entry
        children.clear();
        state.gestureElement = null;
        state.gestureElementType = null;
        state.shouldClearSiblings = false;
      }

      children.addAll(childResults);
    });

    return children;
  }

  /// Checks whether [element]'s immediate parent is the Overlay's
  /// StatefulElement (i.e. its state is OverlayState).
  /// Uses a public type check that survives obfuscated/release builds.
  static bool _isOverlayLevel(Element element) {
    bool found = false;
    element.visitAncestorElements((ancestor) {
      if (ancestor is StatefulElement && ancestor.state is OverlayState) {
        found = true;
        return false;
      }
      return false;
    });
    return found;
  }

  /// Performs hit test and updates gesture state if matched.
  /// Returns true if position is within element bounds.
  static bool _performHitTest(Element element, _CaptureState state) {
    final renderObject = element.renderObject;
    if (renderObject == null || (renderObject is RenderBox && !renderObject.hasSize)) {
      return false;
    }

    try {
      final transform = renderObject.getTransformTo(state.rootElement.renderObject);
      final transformedBounds = MatrixUtils.transformRect(transform, renderObject.paintBounds);

      if (!transformedBounds.contains(state.detectionPosition!)) {
        return false;
      }

      // Position is within bounds - check if it's a gesture widget
      final widgetType = state.detectionMode == GestureDetectionMode.click
          ? getClickableWidgetName(element.widget)
          : getScrollableWidgetName(element.widget);

      if (widgetType != null) {
        // Update gesture element (last/deepest match wins)
        state.gestureElement = element;
        state.gestureElementType = widgetType;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /// Gets widget type name from user filter or framework defaults.
  static String? _getWidgetTypeName(Widget widget, Map<Type, String>? widgetFilter) {
    return widgetFilter?[widget.runtimeType] ?? getFrameworkWidgetName(widget);
  }

  /// Checks if element has a valid RenderBox with size.
  static bool _hasValidRenderBox(Element element) {
    final renderObject = element.renderObject;
    return renderObject != null && renderObject is RenderBox && renderObject.hasSize;
  }

  /// Checks if bounds overlap with screen bounds.
  static bool _isInScreenBounds(Rect bounds, Rect? screenBounds) {
    if (screenBounds == null) return true;
    return screenBounds.overlaps(bounds);
  }

  /// Gets global bounds of a RenderBox.
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

  /// Creates a SnapshotNode from an element.
  static SnapshotNode _createNode(
    Element element,
    List<SnapshotNode> children,
    bool isGestureElement,
    String? widgetName,
    Rect bounds,
  ) {
    final widget = element.widget;
    return SnapshotNode(
      label: widgetName ?? widget.runtimeType.toString(),
      type: getWidgetElementType(widget),
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height,
      highlighted: isGestureElement,
      scrollable: getScrollableWidgetName(widget) != null,
      children: children,
    );
  }
}
