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

/// State for tracking information during tree capture
class _CaptureState {
  final Rect? screenBounds;
  final Offset? detectionPosition;
  final DetectionMode? detectionMode;
  final Element rootElement;
  final Map<Type, String>? providedWidgetsTypes;

  // Results accumulated during traversal
  Element? detectedElement;
  String? detectedElementType;

  _CaptureState({
    required this.rootElement,
    this.screenBounds,
    this.detectionPosition,
    this.detectionMode,
    this.providedWidgetsTypes,
  });
}

/// Captures the layout snapshot starting from a given element.
class LayoutSnapshotCapture {
  /// Captures the layout snapshot starting from a given element.
  ///
  /// Algorithm overview (single-pass traversal):
  /// 1. Find the topmost Scaffold to avoid capturing background routes
  /// 2. Create traversal state with all parameters
  /// 3. Collect descendant nodes (detection happens during this pass)
  /// 4. Build scaffold/root node with collected children
  /// 5. Wrap with filtered ancestor nodes (if scaffold was found)
  /// 6. Return result with tree and detected element info
  ///
  /// If [screenBounds] is provided, only widgets visible within these bounds are included.
  ///
  /// If [detectionPosition] and [detectionMode] are provided, the element at that position
  /// will be detected and returned in the result. The detected element will also be marked
  /// as highlighted (if clickable) in the tree.
  ///
  /// If [providedWidgetsTypes] is provided and not empty, ONLY those widget types will be included
  /// in the snapshot (framework widgets are excluded). If null or empty, framework widgets are used.
  static LayoutSnapshotCaptureResult? captureTree(
    Element? rootElement, {
    Rect? screenBounds,
    Offset? detectionPosition,
    DetectionMode? detectionMode,
    Map<Type, String>? providedWidgetsTypes,
  }) {
    return developer.Timeline.timeSync('captureTree', () {
      // Step 1: Validate root element
      if (rootElement == null) return null;

      // Step 2: Find starting point (scaffold or root)
      final scaffoldElement =
          developer.Timeline.timeSync('findTopmostScaffold', () {
        return _findTopmostScaffold(rootElement);
      });
      final startElement = scaffoldElement ?? rootElement;

      // Step 3: Validate starting element
      if (!_hasValidRenderBox(startElement)) return null;

      // Step 4: Create traversal state
      final state = _CaptureState(
        rootElement: rootElement,
        screenBounds: screenBounds,
        detectionPosition: detectionPosition,
        detectionMode: detectionMode,
        providedWidgetsTypes: providedWidgetsTypes,
      );

      // Step 5: Collect descendant nodes (single-pass, detection happens here)
      final children = <LayoutSnapshot>[];
      developer.Timeline.timeSync('collectNodes', () {
        _traverseChildren(startElement, children, state);
      });

      // Step 6: Build scaffold/root node
      var tree = _buildLayoutSnapshot(startElement, children, state);

      // Step 7: Wrap with ancestor nodes (if scaffold was found)
      if (scaffoldElement != null) {
        tree = _wrapWithAncestors(scaffoldElement, tree, state);
      }

      // Step 8: Return result
      return LayoutSnapshotCaptureResult(
        snapshot: tree,
        detectedElement: state.detectedElement,
        detectedElementType: state.detectedElementType,
      );
    });
  }

  /// Checks if an element has a valid RenderBox with size
  static bool _hasValidRenderBox(Element element) {
    final renderObject = element.renderObject;
    return renderObject != null &&
        renderObject is RenderBox &&
        renderObject.hasSize;
  }

  /// Checks if an element should be skipped during traversal
  static bool _shouldSkipElement(Element element) {
    final widget = element.widget;
    return widget is Offstage && widget.offstage;
  }

  /// Gets the node type for a widget based on the capture state
  static String? _getNodeType(Widget widget, _CaptureState state) {
    if (state.providedWidgetsTypes != null &&
        state.providedWidgetsTypes!.isNotEmpty) {
      return _getUserProvidedWidget(widget, state.providedWidgetsTypes);
    }
    return _getFrameworkWidget(widget);
  }

  /// Checks if a render box is within screen bounds
  static bool _isInScreenBounds(RenderBox renderBox, Rect? screenBounds) {
    if (screenBounds == null) return true;
    final bounds = _getBounds(renderBox);
    return screenBounds.overlaps(bounds);
  }

  /// Determines if an element should be included as a node in the tree
  static bool _shouldIncludeInTree(Element element, _CaptureState state) {
    final renderObject = element.renderObject;

    // Must have valid render box
    if (renderObject is! RenderBox || !renderObject.hasSize) {
      return false;
    }

    // Must be in screen bounds
    if (!_isInScreenBounds(renderObject, state.screenBounds)) {
      return false;
    }

    // Must match widget type filter OR be the detected element
    final hasMatchingType = _getNodeType(element.widget, state) != null;
    final isDetected = (state.detectedElement == element);

    return hasMatchingType || isDetected;
  }

  /// Tries to detect an element at the detection position
  /// Updates the state if a matching element is found
  static void _tryDetectElement(Element element, _CaptureState state) {
    // Skip if already detected or detection not enabled
    if (state.detectedElement != null ||
        state.detectionPosition == null ||
        state.detectionMode == null) {
      return;
    }

    final renderObject = element.renderObject;
    if (renderObject is! RenderBox || !renderObject.hasSize) {
      return;
    }

    // Check if this element is the right type for detection
    String? detectedType;
    if (state.detectionMode == DetectionMode.click) {
      detectedType = _getClickableWidgetType(element.widget);
    } else if (state.detectionMode == DetectionMode.scroll) {
      detectedType = _getScrollableWidgetType(element.widget);
    }

    // If it matches and is at the position, record it
    if (detectedType != null &&
        _hitTest(element, state.detectionPosition!, state.rootElement)) {
      state.detectedElement = element;
      state.detectedElementType = detectedType;
    }
  }

  /// Builds a LayoutSnapshot node from an element
  static LayoutSnapshot _buildLayoutSnapshot(
    Element element,
    List<LayoutSnapshot> children,
    _CaptureState state,
  ) {
    final renderObject = element.renderObject as RenderBox;
    final bounds = _getBounds(renderObject);
    final widget = element.widget;

    // Determine the node type
    final nodeType = _getNodeType(widget, state);
    final isDetected = (state.detectedElement == element);
    final effectiveNodeType = isDetected && nodeType == null
        ? state.detectedElementType
        : nodeType;

    // Determine highlighting (for click detection)
    final isHighlighted = state.detectionMode == DetectionMode.click && isDetected;

    // Determine scroll-ability
    final isScrollable = _getScrollableWidgetType(widget) != null;

    // Extract ID from key
    final id = _extractKeyAsId(element);

    return LayoutSnapshot(
      widgetName: effectiveNodeType ?? 'Unknown',
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height,
      id: id,
      highlighted: isHighlighted,
      scrollable: isScrollable,
      children: children,
    );
  }

  /// Collects nodes from element tree in a single pass
  static void _collectNodes(
    Element element,
    List<LayoutSnapshot> output,
    _CaptureState state,
  ) {
    // Early exit for offstage widgets
    if (_shouldSkipElement(element)) return;

    // Try to detect this element (updates state if found)
    _tryDetectElement(element, state);

    // Decide if this element should be a tree node
    if (_shouldIncludeInTree(element, state)) {
      _createNodeWithChildren(element, output, state);
    } else {
      // Not included, but still traverse children
      _traverseChildren(element, output, state);
    }
  }

  /// Creates a node for the element and traverses its children
  static void _createNodeWithChildren(
    Element element,
    List<LayoutSnapshot> output,
    _CaptureState state,
  ) {
    final children = <LayoutSnapshot>[];

    // Collect children into the node
    element.visitChildElements((child) {
      _collectNodes(child, children, state);
    });

    // Build the node with its children
    final node = _buildLayoutSnapshot(element, children, state);
    output.add(node);
  }

  /// Traverses children without creating a node for this element
  static void _traverseChildren(
    Element element,
    List<LayoutSnapshot> output,
    _CaptureState state,
  ) {
    element.visitChildElements((child) {
      _collectNodes(child, output, state);
    });
  }

  /// Wraps a scaffold node with filtered ancestor nodes
  /// Returns the topmost ancestor node, or the original node if no ancestors match
  static LayoutSnapshot _wrapWithAncestors(
    Element scaffoldElement,
    LayoutSnapshot scaffoldNode,
    _CaptureState state,
  ) {
    final ancestors = <Element>[];

    // Walk up the parent chain to collect ancestors
    scaffoldElement.visitAncestorElements((ancestor) {
      ancestors.add(ancestor);
      return ancestor != state.rootElement; // continue until root
    });

    // Filter and wrap from top-down (reverse order)
    LayoutSnapshot result = scaffoldNode;
    for (final ancestor in ancestors.reversed) {
      if (_shouldIncludeInTree(ancestor, state)) {
        result = _buildLayoutSnapshot(ancestor, [result], state);
      }
    }

    return result;
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

  /// Extracts a string ID from the element's key
  static String? _extractKeyAsId(Element element) {
    final key = element.widget.key;
    if (key == null) return null;
    if (key is ValueKey<String>) {
      return key.value;
    }

    return null;
  }

  /// Finds the topmost (active) Scaffold or CupertinoPageScaffold element in the tree
  /// Returns the last Scaffold/CupertinoPageScaffold found, which is the topmost in render order
  static Element? _findTopmostScaffold(Element rootElement) {
    Element? topmostScaffold;

    void findScaffoldsRecursively(Element element) {
      // Skip Offstage widgets
      final widget = element.widget;
      if (widget is Offstage && widget.offstage) {
        return;
      }

      if (widget.runtimeType == Scaffold ||
          widget.runtimeType == CupertinoPageScaffold) {
        topmostScaffold = element;
      }

      element.visitChildElements(findScaffoldsRecursively);
    }

    findScaffoldsRecursively(rootElement);
    return topmostScaffold;
  }

  static bool _hitTest(Element element, Offset position, Element? rootElement) {
    if (rootElement == null) return false;

    final renderObject = element.renderObject;
    if (renderObject == null ||
        (renderObject is RenderBox && !renderObject.hasSize)) {
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
    final paintBounds =
        MatrixUtils.transformRect(transform, renderObject.paintBounds);
    return paintBounds.contains(position);
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

  static String? _getUserProvidedWidget(
      Widget widget, Map<Type, String>? providedWidgets) {
    final type = widget.runtimeType;
    if (providedWidgets?.keys.contains(type) == true) {
      return providedWidgets?[type];
    }
    return null;
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
      GestureDetector w
          when w.onTap != null ||
              w.onDoubleTap != null ||
              w.onLongPress != null =>
        'GestureDetector',
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
}
