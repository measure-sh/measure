import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../measure_flutter.dart';

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
  final String? gestureElementLabel;

  LayoutSnapshotCaptureResult({
    required this.snapshot,
    this.gestureElement,
    this.gestureElementType,
    this.gestureElementLabel,
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
  /// Returns a [SnapshotNode] tree containing widget positions, sizes, and types.
  /// Fully occluded widgets are automatically excluded from the result.
  ///
  /// If [screenBounds] is provided, only widgets overlapping the specified screen
  /// region are included.
  ///
  /// If [detectionPosition] and [detectionMode] are provided, detects and highlights
  /// the widget at that position. The detected element is returned in
  /// [LayoutSnapshotCaptureResult.gestureElement].
  ///
  /// The [widgetFilter] map specifies which widget types to include. When null or
  /// empty, a default set of framework widgets is used.
  ///
  /// When [includeText] is true, node labels contain extracted text content instead
  /// of widget type names.
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
    if (rootElement == null || !_hasValidRenderBox(rootElement)) {
      return null;
    }
    final state = _initState(rootElement, screenBounds, detectionPosition, detectionMode, widgetFilter);
    final snapshot = _traverseNodesRecursively(rootElement, state);
    return LayoutSnapshotCaptureResult(
      snapshot: snapshot.last,
      gestureElement: state.gestureElement,
      gestureElementType: state.gestureElementType,
      gestureElementLabel: state.gestureElementLabel,
    );
  }

  static bool _hitTest(Element element, Offset position, Element rootElement) {
    final renderObject = element.renderObject;
    if (renderObject == null || (renderObject is RenderBox && !renderObject.hasSize)) {
      return false;
    }
    final transform = renderObject.getTransformTo(rootElement.renderObject);
    final transformedBounds = MatrixUtils.transformRect(transform, renderObject.paintBounds);
    return transformedBounds.contains(position);
  }

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

  static String? _getUserProvidedWidget(Widget widget, Map<Type, String>? providedWidgets) {
    return providedWidgets?[widget.runtimeType];
  }

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

  static String? _getScrollableWidgetType(Widget widget) {
    return switch (widget) {
      ListView _ => 'ListView',
      PageView _ => 'PageView',
      SingleChildScrollView _ => 'SingleChildScrollView',
      ScrollView _ => 'ScrollView',
      _ => null,
    };
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

  static List<SnapshotNode> _traverseNodesRecursively(Element element, _CaptureState state) {
    final List<SnapshotNode> allChildren = [];
    final renderObject = element.renderObject;

    if (!_hasValidRenderBox(element)) {
      final List<SnapshotNode> promotedChildren = [];
      element.visitChildElements((child) {
        promotedChildren.addAll(_traverseNodesRecursively(child, state));
      });
      return promotedChildren;
    }

    if (renderObject is! RenderBox) {
      final List<SnapshotNode> promotedChildren = [];
      element.visitChildElements((child) {
        promotedChildren.addAll(_traverseNodesRecursively(child, state));
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

    final isInScreenBounds = _isInScreenBounds(renderObject, state.screenBounds);
    final matchedType = _getUserProvidedWidget(element.widget, state.widgetFilter) ?? _getFrameworkWidget(element.widget);

    if (isVisible) {
      if (state.detectionPosition != null && state.detectionMode != null) {
        _updateGestureElementIfMatch(element, state);
      }

      element.visitChildElements((child) {
        allChildren.addAll(_traverseNodesRecursively(child, state));
      });

      final isGestureElement = state.gestureElement == element;

      if (isGestureElement || (isInScreenBounds && matchedType != null)) {
        return [_createNode(element, state, allChildren, isGestureElement, matchedType)];
      }
    }

    return allChildren;
  }

  /// Checks if this element matches the hit test and updates state if it's the topmost match
  static void _updateGestureElementIfMatch(Element element, _CaptureState state) {
    if (!_hitTest(element, state.detectionPosition!, state.rootElement)) {
      return;
    }

    final widgetType = state.detectionMode == GestureDetectionMode.click
        ? _getClickableWidgetType(element.widget)
        : _getScrollableWidgetType(element.widget);

    if (widgetType == null) {
      return;
    }

    // Update the state - this will keep getting updated for elements higher in z-order
    // The last update wins (topmost element)
    state.gestureElement = element;
    state.gestureElementType = widgetType;
    state.gestureElementLabel = widgetType;
  }

  /// Checks if a render box is within screen bounds
  static bool _isInScreenBounds(RenderBox renderBox, Rect? screenBounds) {
    if (screenBounds == null) return true;
    final bounds = _getBounds(renderBox);
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

  /// Creates a SnapshotNode from an element with its children
  static SnapshotNode _createNode(
      Element element, _CaptureState state, List<SnapshotNode> children, bool isGestureElement, String? widgetName) {
    final renderObject = element.renderObject;
    if (renderObject is! RenderBox) {
      throw StateError('Attempted to create node for element without RenderBox. '
          'Element: ${element.widget.runtimeType}, '
          'RenderObject: ${renderObject.runtimeType}');
    }
    final bounds = _getBounds(renderObject);
    final isScrollable = _getScrollableWidgetType(element.widget) != null;
    String label = widgetName ?? element.widget.runtimeType.toString();
    return SnapshotNode(
      label: label,
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
