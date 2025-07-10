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
    final tapInfo = _findElementAt(position, _isClickableElement, true);
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
    final tapInfo = _findElementAt(position, _isClickableElement, true);
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
    final scrollInfo = _findElementAt(position, _isScrollableElement, false);
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
    bool Function(Element) predicate,
    bool isClickable,
  ) {
    final rootElement = _clickTrackerElement;
    if (rootElement == null) return null;

    DetectedElement? result;

    void elementFinder(Element element) {
      if (result != null) return;

      if (!_isElementHitTestable(element, position)) return;

      if (predicate(element)) {
        final type = isClickable
            ? _getClickableElementType(element)
            : _getScrollableElementType(element);
        if (type != null) {
          result = DetectedElement(element: element, type: type);
        }
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

  bool _isClickableElement(Element element) {
    final widget = element.widget;
    return _isClickable(widget);
  }

  bool _isScrollableElement(Element element) {
    final widget = element.widget;
    return _isScrollable(widget);
  }

  String? _getClickableElementType(Element element) {
    final widget = element.widget;
    if (!_isClickable(widget)) return null;
    return widget.runtimeType.toString();
  }

  String? _getScrollableElementType(Element element) {
    final widget = element.widget;
    if (!_isScrollable(widget)) return null;
    return widget.runtimeType.toString();
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

  bool _isClickable(Widget widget) {
    return switch (widget) {
      ButtonStyleButton w => w.enabled,
      MaterialButton w => w.enabled,
      IconButton w => w.onPressed != null,
      FloatingActionButton w => w.onPressed != null,
      CupertinoButton w => w.enabled,
      ListTile _ => true,
      PopupMenuButton w => w.enabled,
      PopupMenuItem w => w.enabled,
      DropdownButton w => w.onChanged != null,
      DropdownMenuItem _ => true,
      ExpansionTile _ => true,
      Card _ => true,
      InkWell w => w.onTap != null,
      GestureDetector w =>
        w.onTap != null || w.onDoubleTap != null || w.onLongPress != null,
      InkResponse w => w.onTap != null,
      InputChip w => w.onPressed != null,
      ActionChip w => w.onPressed != null,
      FilterChip w => w.onSelected != null,
      ChoiceChip w => w.onSelected != null,
      Checkbox w => w.onChanged != null,
      Switch w => w.onChanged != null,
      Radio w => w.onChanged != null,
      CupertinoSwitch w => w.onChanged != null,
      CheckboxListTile w => w.onChanged != null,
      SwitchListTile w => w.onChanged != null,
      RadioListTile w => w.onChanged != null,
      Slider w => w.onChanged != null,
      RangeSlider w => w.onChanged != null,
      CupertinoSlider w => w.onChanged != null,
      TextField _ => true,
      TextFormField _ => true,
      CupertinoTextField _ => true,
      Stepper _ => true,
      _ => false,
    };
  }

  bool _isScrollable(Widget widget) {
    return widget is ScrollView ||
        widget is ListView ||
        widget is PageView ||
        widget is SingleChildScrollView;
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
