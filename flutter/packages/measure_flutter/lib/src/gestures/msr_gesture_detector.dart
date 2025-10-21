import 'dart:developer' as developer;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/gestures/scroll_direction.dart';

import 'detected_element.dart';
import 'long_click_data.dart';

const _tapDeltaArea = 20 * 20;
const _longClickDuration = Duration(milliseconds: 500);
Element? _clickTrackerElement;

class MsrGestureDetector extends StatefulWidget {
  final Widget child;
  final Function(ClickData) onClick;
  final Function(LongClickData) onLongClick;
  final Function(ScrollData) onScroll;

  const MsrGestureDetector({
    super.key,
    required this.child,
    required this.onClick,
    required this.onLongClick,
    required this.onScroll,
  });

  @override
  StatefulElement createElement() {
    final element = super.createElement();
    _clickTrackerElement = element;
    return element;
  }

  @override
  MsrGestureDetectorState createState() => MsrGestureDetectorState();
}

class MsrGestureDetectorState extends State<MsrGestureDetector> {
  int? _lastPointerId;
  Offset? _lastPointerDownLocation;
  Duration? _pointerDownTime;
  bool _isScrolling = false;

  @override
  Widget build(BuildContext context) {
    final devicePixelRatio = MediaQuery.of(context).devicePixelRatio;
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: onPointerDown,
      onPointerUp: (event) => onPointerUp(event, devicePixelRatio),
      onPointerMove: _onPointerMove,
      onPointerCancel: _onPointerCancel,
      child: widget.child,
    );
  }

  @visibleForTesting
  void onPointerDown(PointerDownEvent event) {
    try {
      _lastPointerId = event.pointer;
      _lastPointerDownLocation = event.position;
      _pointerDownTime = event.timeStamp;
    } catch (exception, stacktrace) {
      _logError('onPointerDown', exception, stacktrace);
    }
  }

  @visibleForTesting
  void onPointerUp(PointerUpEvent event, double devicePixelRatio) {
    try {
      final location = _lastPointerDownLocation;
      final downTime = _pointerDownTime;
      if (location == null ||
          event.pointer != _lastPointerId ||
          downTime == null) {
        return;
      }

      final delta = event.position - location;
      final duration = event.timeStamp - downTime;

      if (delta.distanceSquared < _tapDeltaArea) {
        if (duration >= _longClickDuration) {
          _handleLongClick(
              event.position, downTime, event.timeStamp, devicePixelRatio);
        } else {
          _handleClick(event.position, devicePixelRatio);
        }
      }

      if (_isScrolling) {
        _handleScrollEnd(event.position, delta, devicePixelRatio);
      }

      _resetState();
    } catch (exception, stacktrace) {
      _logError('onPointerUp', exception, stacktrace);
    }
  }

  void _onPointerMove(PointerMoveEvent event) {
    try {
      if (_lastPointerId != event.pointer) return;

      final lastLocation = _lastPointerDownLocation;
      if (lastLocation != null) {
        final delta = event.position - lastLocation;
        if (delta.distanceSquared > _tapDeltaArea) {
          _isScrolling = true;
        }
      }
    } catch (exception, stacktrace) {
      _logError('onPointerMove', exception, stacktrace);
    }
  }

  void _onPointerCancel(PointerCancelEvent event) {
    _resetPointerState();
  }

  void _resetPointerState() {
    _lastPointerDownLocation = null;
    _lastPointerId = null;
    _pointerDownTime = null;
    _isScrolling = false;
  }

  void _handleClick(Offset position, double devicePixelRatio) {
    final tapInfo = _findElementAt(position, _getClickableElementType, true);
    if (tapInfo == null) {
      developer.log("No clickable element found at $position", name: 'measure');
      return;
    }

    final label = _extractLabel(tapInfo.element);
    widget.onClick(
      ClickData(
        target: tapInfo.type,
        x: (position.dx * devicePixelRatio).roundToDouble(),
        y: (position.dy * devicePixelRatio).roundToDouble(),
        targetId: truncateLabel(label, maxLength: 32),
        touchDownTime: null,
        touchUpTime: null,
      ),
    );
  }

  void _handleLongClick(
    Offset position,
    Duration downTime,
    Duration upTime,
    double devicePixelRatio,
  ) {
    final tapInfo = _findElementAt(position, _getClickableElementType, true);
    if (tapInfo == null) {
      developer.log("No clickable element found at $position", name: 'measure');
      return;
    }

    final label = _extractLabel(tapInfo.element);
    widget.onLongClick(
      LongClickData(
        target: tapInfo.type,
        x: (position.dx * devicePixelRatio).roundToDouble(),
        y: (position.dy * devicePixelRatio).roundToDouble(),
        targetId: truncateLabel(label, maxLength: 32),
        touchDownTime: null,
        touchUpTime: null,
      ),
    );
  }

  void _handleScrollEnd(
      Offset position, Offset delta, double devicePixelRatio) {
    final scrollInfo =
        _findElementAt(position, _getScrollableElementType, false);
    if (scrollInfo == null) {
      return;
    }

    final scrollAxis = _findScrollAxis(scrollInfo.element.widget);
    final scrollDirection = _findScrollDirection(delta);
    final isValidScroll = _validateScroll(scrollAxis, scrollDirection);
    if (!isValidScroll) {
      return;
    }

    widget.onScroll(
      ScrollData(
        target: scrollInfo.type,
        x: ((position.dx - delta.dx) * devicePixelRatio).roundToDouble(),
        y: ((position.dy - delta.dy) * devicePixelRatio).roundToDouble(),
        endX: (position.dx * devicePixelRatio).roundToDouble(),
        endY: (position.dy * devicePixelRatio).roundToDouble(),
        targetId: null,
        direction: scrollDirection,
        touchDownTime: null,
        touchUpTime: null,
      ),
    );
  }

  DetectedElement? _findElementAt(
    Offset position,
    String? Function(Element) predicate,
    bool isClickable,
  ) {
    final rootElement = _clickTrackerElement;
    if (rootElement == null) return null;

    DetectedElement? result;

    void elementFinder(Element element) {
      if (result != null) return;

      if (!_isElementHitTestable(element, position)) return;

      final type = predicate(element);
      if (type != null) {
        result = DetectedElement(element: element, type: type);
      }

      if (result == null) {
        element.visitChildElements(elementFinder);
      }
    }

    rootElement.visitChildElements(elementFinder);
    return result;
  }

  bool _isElementHitTestable(Element element, Offset position) {
    final rootElement = _clickTrackerElement;
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

  String? _getClickableElementType(Element element) {
    final widget = element.widget;
    return _getClickableType(widget);
  }

  String? _getScrollableElementType(Element element) {
    final widget = element.widget;
    return _getScrollableType(widget);
  }

  String? _extractLabel(Element element) {
    final widget = element.widget;

    return switch (widget) {
      Text w => w.data,
      Semantics w => w.properties.label,
      Icon w => w.semanticLabel,
      Tooltip w => w.message,
      ButtonStyleButton w when w.child is Text => (w.child as Text).data,
      ListTile w when w.title is Text => (w.title as Text).data,
      InkWell w when w.child is Text => (w.child as Text).data,
      _ => null,
    };
  }

  String? _getClickableType(Widget widget) {
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

  String? _getScrollableType(Widget widget) {
    return switch (widget) {
      ListView _ => 'ListView',
      PageView _ => 'PageView',
      SingleChildScrollView _ => 'SingleChildScrollView',
      ScrollView _ => 'ScrollView',
      _ => null,
    };
  }

  Axis? _findScrollAxis(Widget widget) {
    return switch (widget) {
      ListView w => w.scrollDirection,
      ScrollView w => w.scrollDirection,
      PageView w => w.scrollDirection,
      SingleChildScrollView w => w.scrollDirection,
      _ => null
    };
  }

  MsrScrollDirection _findScrollDirection(Offset delta) {
    if (delta.dx.abs() > delta.dy.abs()) {
      return delta.dx > 0 ? MsrScrollDirection.right : MsrScrollDirection.left;
    } else {
      return delta.dy > 0 ? MsrScrollDirection.down : MsrScrollDirection.up;
    }
  }

  bool _validateScroll(Axis? scrollAxis, MsrScrollDirection scrollDirection) {
    switch (scrollAxis) {
      case null:
        return false;
      case Axis.horizontal:
        return scrollDirection == MsrScrollDirection.left ||
            scrollDirection == MsrScrollDirection.right;
      case Axis.vertical:
        return scrollDirection == MsrScrollDirection.up ||
            scrollDirection == MsrScrollDirection.down;
    }
  }

  String? truncateLabel(String? label, {int maxLength = 32}) {
    if (label == null || label.length <= maxLength) {
      return label;
    }
    return '${label.substring(0, maxLength - 3)}...';
  }

  void _resetState() {
    _pointerDownTime = null;
    _lastPointerDownLocation = null;
    _isScrolling = false;
    _lastPointerId = null;
  }

  void _logError(String method, Object exception, StackTrace stackTrace) {
    developer.log('Error in $method: $exception',
        stackTrace: stackTrace, name: 'measure');
  }
}
