import 'dart:developer' as developer;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../measure_flutter.dart';

/// Mode for detecting elements at a position
enum DetectionMode {
  /// Detect clicked element
  click,

  /// Detect scrolled element
  scroll,
}

/// Result of capturing a layout snapshot with optional detected element info
class LayoutSnapshotCaptureResult {
  final LayoutSnapshot snapshot;
  final Element? detectedElement;
  final String? detectedElementType;

  LayoutSnapshotCaptureResult({
    required this.snapshot,
    this.detectedElement,
    this.detectedElementType,
  });
}

/// Context for tracking detected elements during tree capture
class _CaptureContext {
  Element? detectedElement;
  String? detectedElementType;
}

/// Captures the layout snapshot starting from a given element
class LayoutSnapshotCapture {
  /// Automatically finds the topmost Scaffold and uses it as the root node to ensure
  /// only the active route is captured (not background routes in the Navigator stack).
  /// The Scaffold (or root element if no Scaffold found) is always included as the top-level node.
  ///
  /// If [screenBounds] is provided, only widgets visible within these bounds are included.
  ///
  /// If [detectionPosition] and [detectionMode] are provided, the element at that position
  /// will be detected and returned in the result. The detected element will also be marked
  /// as highlighted (if clickable) in the tree.
  static LayoutSnapshotCaptureResult? captureTree(
    Element? rootElement, {
    Rect? screenBounds,
    Offset? detectionPosition,
    DetectionMode? detectionMode,
    Map<Type, String>? providedWidgetsTypes,
  }) {
    return developer.Timeline.timeSync('captureTree', () {
      if (rootElement == null) return null;

      // Find the topmost Scaffold to start capture from
      final scaffoldElement = developer.Timeline.timeSync('findTopmostScaffold', () {
        return _findTopmostScaffold(rootElement);
      });
      final startElement = scaffoldElement ?? rootElement;

      // Get the starting element's render object and bounds
      final renderObject = startElement.renderObject;
      if (renderObject == null || renderObject is! RenderBox || !renderObject.hasSize) {
        return null;
      }

      final bounds = _getBounds(renderObject);
      final widgetName = startElement.widget.runtimeType.toString();
      final id = _extractKeyAsId(startElement);

      // Create context for tracking detected elements (if detection is enabled)
      final context = (detectionPosition != null && detectionMode != null) ? _CaptureContext() : null;

      // Collect filtered children (start from children to avoid duplicating the root)
      final children = <LayoutSnapshot>[];
      developer.Timeline.timeSync('collectNodes', () {
        startElement.visitChildElements((childElement) {
          _collectNodesHierarchical(
            childElement,
            children,
            screenBounds,
            detectionPosition,
            detectionMode,
            rootElement,
            context,
            providedWidgetsTypes,
          );
        });
      });

      // Create the tree node
      final tree = LayoutSnapshot(
        widgetName: widgetName,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
        id: id,
        children: children,
      );

      // Return the result with tree and optional detected element
      return LayoutSnapshotCaptureResult(
        snapshot: tree,
        detectedElement: context?.detectedElement,
        detectedElementType: context?.detectedElementType,
      );
    });
  }

  static void _collectNodesHierarchical(
    Element element,
    List<LayoutSnapshot> parentChildren,
    Rect? screenBounds,
    Offset? detectionPosition,
    DetectionMode? detectionMode,
    Element? rootElement,
    _CaptureContext? context,
    Map<Type, String>? providedWidgetsTypes,
  ) {
    // Skip Offstage widgets that are not visible (offstage: true)
    // This filters out inactive routes in Navigator
    final widget = element.widget;
    if (widget is Offstage && widget.offstage) {
      return;
    }

    final renderObject = element.renderObject;

    // Check for detection on this element (before checking if it should be in the tree)
    if (context != null &&
        context.detectedElement == null &&
        detectionPosition != null &&
        detectionMode != null &&
        renderObject is RenderBox &&
        renderObject.hasSize) {
      // Determine which type to check based on detection mode
      String? detectedType;
      if (detectionMode == DetectionMode.click) {
        detectedType = _getClickableWidgetType(widget);
      } else if (detectionMode == DetectionMode.scroll) {
        detectedType = _getScrollableWidgetType(widget);
      }

      if (detectedType != null && _hitTest(element, detectionPosition, rootElement)) {
        context.detectedElement = element;
        context.detectedElementType = detectedType;
      }
    }

    // Check if this element should be included in the snapshot (for tree inclusion)
    if (renderObject is RenderBox && renderObject.hasSize) {
      // Check if this is the detected element or if it matches the filter
      final widgetType = _getFrameworkWidget(widget) ?? _getUserProvidedWidget(widget, providedWidgetsTypes);
      final isDetectedElement = (context?.detectedElement == element);

      // Include if it matches filter OR if it's the detected element
      if (widgetType != null || isDetectedElement) {
        final bounds = _getBounds(renderObject);

        // Only include if within screen bounds (if bounds are provided)
        if (screenBounds == null || screenBounds.overlaps(bounds)) {
          // Use the detected type if this is the detected element, otherwise use filter type
          final nodeType = isDetectedElement && widgetType == null ? context?.detectedElementType : widgetType;
          final children = <LayoutSnapshot>[];

          // Recursively collect children for this matched node
          element.visitChildElements((childElement) {
            _collectNodesHierarchical(
              childElement,
              children,
              screenBounds,
              detectionPosition,
              detectionMode,
              rootElement,
              context,
              providedWidgetsTypes,
            );
          });

          // Extract key as ID if available
          final id = _extractKeyAsId(element);

          // Check if this element is highlighted (clicked)
          bool isHighlighted = false;
          if (detectionMode == DetectionMode.click && context?.detectedElement == element) {
            isHighlighted = true;
          }

          // Check if this element is scrollable
          bool isScrollable = false;
          final scrollableType = _getScrollableWidgetType(widget);
          if (scrollableType != null) {
            isScrollable = true;
          }

          parentChildren.add(LayoutSnapshot(
            widgetName: nodeType ?? 'Unknown',
            x: bounds.left,
            y: bounds.top,
            width: bounds.width,
            height: bounds.height,
            id: id,
            highlighted: isHighlighted,
            scrollable: isScrollable,
            children: children,
          ));

          // Since we matched and handled this node and its subtree, return
          return;
        }
      }
    }

    // Node didn't match or wasn't within bounds - collapse it and continue with children
    element.visitChildElements((childElement) {
      _collectNodesHierarchical(
        childElement,
        parentChildren,
        screenBounds,
        detectionPosition,
        detectionMode,
        rootElement,
        context,
        providedWidgetsTypes,
      );
    });
  }

  static Rect _getBounds(RenderBox renderBox) {
    if (!renderBox.hasSize) {
      return Rect.zero;
    }

    try {
      // Get position relative to root
      final offset = renderBox.localToGlobal(Offset.zero);
      final size = renderBox.size;
      return Rect.fromLTWH(offset.dx, offset.dy, size.width, size.height);
    } catch (e) {
      return Rect.zero;
    }
  }

  /// Extracts a string ID from the element's key
  static String? _extractKeyAsId(Element element) {
    final key = element.widget.key;
    if (key == null) return null;

    // Handle ValueKey<String>
    if (key is ValueKey<String>) {
      return key.value;
    }

    return null;
  }

  /// Finds the topmost (active) Scaffold or CupertinoPageScaffold element in the tree
  /// Returns the last Scaffold/CupertinoPageScaffold found, which is the topmost in render order
  static Element? _findTopmostScaffold(Element rootElement) {
    Element? topmostScaffold;

    void findScaffolds(Element element) {
      // Skip Offstage widgets
      final widget = element.widget;
      if (widget is Offstage && widget.offstage) {
        return;
      }

      // Check if this is a Scaffold or CupertinoPageScaffold
      if (widget.runtimeType == Scaffold || widget.runtimeType == CupertinoPageScaffold) {
        // Keep updating to get the last (topmost) Scaffold
        topmostScaffold = element;
      }

      // Continue traversing children
      element.visitChildElements(findScaffolds);
    }

    findScaffolds(rootElement);
    return topmostScaffold;
  }

  /// Checks if an element is hit-testable at the given position
  static bool _hitTest(Element element, Offset position, Element? rootElement) {
    if (rootElement == null) return false;

    final renderObject = element.renderObject;
    if (renderObject == null || (renderObject is RenderBox && !renderObject.hasSize)) {
      return false;
    }

    // Check hit test
    if (renderObject is RenderPointerListener) {
      final hitResult = BoxHitTestResult();
      if (!renderObject.hitTest(hitResult, position: position)) {
        return false;
      }
    }

    // Check bounds
    final transform = renderObject.getTransformTo(rootElement.renderObject);
    final paintBounds = MatrixUtils.transformRect(transform, renderObject.paintBounds);
    return paintBounds.contains(position);
  }

  /// Returns the widget type if it should be included in the layout snapshot. This
  /// filters widgets that are "interesting" enough to include in the snapshot/
  ///
  /// Returns the widget type name if it should be included, null otherwise.
  static String? _getFrameworkWidget(Widget widget) {
    final type = switch (widget) {
      FilledButton _ => 'FilledButton',
      OutlinedButton _ => 'OutlinedButton',
      TextButton _ => 'TextButton',
      ElevatedButton _ => 'ElevatedButton',
      CupertinoButton _ => 'CupertinoButton',
      ButtonStyleButton _ => 'ButtonStyleButton',
      MaterialButton _ => 'MaterialButton',
      IconButton _ => 'IconButton',
      FloatingActionButton _ => 'FloatingActionButton',
      ListTile _ => 'ListTile',
      PopupMenuButton _ => 'PopupMenuButton',
      PopupMenuItem _ => 'PopupMenuItem',
      DropdownButton w when w.onChanged != null => 'DropdownButton',
      DropdownMenuItem _ => 'DropdownMenuItem',
      ExpansionTile _ => 'ExpansionTile',
      Card _ => 'Card',
      Scaffold _ => 'Scaffold',
      CupertinoPageScaffold _ => 'CupertinoPageScaffold',
      MaterialApp _ => 'MaterialApp',
      CupertinoApp _ => 'CupertinoApp',
      Container _ => 'Container',
      Row _ => 'Row',
      Column _ => 'Column',
      ListView _ => 'ListView',
      PageView _ => 'PageView',
      SingleChildScrollView _ => 'SingleChildScrollView',
      ScrollView _ => 'ScrollView',
      Text _ => 'Text',
      RichText _ => 'RichText',
      _ => null,
    };
    return type;
  }

  /// Returns the widget type if it should be included in the layout snapshot.
  static String? _getUserProvidedWidget(Widget widget, Map<Type, String>? providedWidgets) {
    final type = widget.runtimeType;
    if (providedWidgets?.keys.contains(type) == true) {
      return providedWidgets?[type];
    }
    return null;
  }

  /// Returns the widget type if it's clickable
  static String? _getClickableWidgetType(Widget widget) {
    return switch (widget) {
      FilledButton w when w.enabled => 'FilledButton',
      OutlinedButton w when w.enabled => 'OutlinedButton',
      CupertinoButton w when w.enabled => 'CupertinoButton',
      TextButton w when w.enabled => 'TextButton',
      ElevatedButton w when w.enabled => 'ElevatedButton',
      ButtonStyleButton w when w.enabled => 'ButtonStyleButton',
      MaterialButton w when w.enabled => 'MaterialButton',
      IconButton w when w.onPressed != null => 'IconButton',
      FloatingActionButton w when w.onPressed != null => 'FloatingActionButton',
      CupertinoButton w when w.enabled => 'CupertinoButton',
      ListTile _ => 'ListTile',
      PopupMenuButton w when w.enabled => 'PopupMenuButton',
      PopupMenuItem w when w.enabled => 'PopupMenuItem',
      DropdownButton w when w.onChanged != null => 'DropdownButton',
      DropdownMenuItem _ => 'DropdownMenuItem',
      ExpansionTile _ => 'ExpansionTile',
      Card _ => 'Card',
      InkWell w when w.onTap != null => 'InkWell',
      GestureDetector w when w.onTap != null || w.onDoubleTap != null || w.onLongPress != null => 'GestureDetector',
      InkResponse w when w.onTap != null => 'InkResponse',
      InputChip w when w.onPressed != null => 'InputChip',
      ActionChip w when w.onPressed != null => 'ActionChip',
      FilterChip w when w.onSelected != null => 'FilterChip',
      ChoiceChip w when w.onSelected != null => 'ChoiceChip',
      Checkbox w when w.onChanged != null => 'Checkbox',
      Switch w when w.onChanged != null => 'Switch',
      Radio _ => 'Radio',
      CupertinoSwitch w when w.onChanged != null => 'CupertinoSwitch',
      CheckboxListTile w when w.onChanged != null => 'CheckboxListTile',
      SwitchListTile w when w.onChanged != null => 'SwitchListTile',
      RadioListTile _ => 'RadioListTile',
      Slider w when w.onChanged != null => 'Slider',
      RangeSlider w when w.onChanged != null => 'RangeSlider',
      CupertinoSlider w when w.onChanged != null => 'CupertinoSlider',
      TextField _ => 'TextField',
      TextFormField _ => 'TextFormField',
      CupertinoTextField _ => 'CupertinoTextField',
      Stepper _ => 'Stepper',
      _ => null,
    };
  }

  /// Returns the widget type if it's scrollable
  static String? _getScrollableWidgetType(Widget widget) {
    return switch (widget) {
      ListView _ => 'ListView',
      PageView _ => 'PageView',
      SingleChildScrollView _ => 'SingleChildScrollView',
      ScrollView _ => 'ScrollView',
      _ => null,
    };
  }
}
