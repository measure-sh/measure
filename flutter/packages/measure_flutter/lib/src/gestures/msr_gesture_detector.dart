import 'dart:developer';

import 'package:flutter/material.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_widget_filters.dart';
import 'package:measure_flutter/src/gestures/msr_scroll_direction.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/logger/log_level.dart';

import '../../measure_flutter.dart';
import 'long_click_data.dart';

const _tapDeltaArea = 20 * 20;
const _longClickDuration = Duration(milliseconds: 500);
Element? _clickTrackerElement;

class MsrGestureDetector extends StatefulWidget {
  final Widget child;
  final Map<Type, String> layoutSnapshotWidgetFilter;
  final Future<void> Function(ClickData, SnapshotNode?) onClick;
  final Future<void> Function(LongClickData, SnapshotNode?) onLongClick;
  final Future<void> Function(ScrollData) onScroll;

  const MsrGestureDetector({
    super.key,
    required this.layoutSnapshotWidgetFilter,
    required this.onClick,
    required this.onLongClick,
    required this.onScroll,
    required this.child,
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
    final screenSize = MediaQuery.of(context).size;
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: _onPointerDown,
      onPointerUp: (event) => _onPointerUp(event, devicePixelRatio, screenSize),
      onPointerMove: _onPointerMove,
      onPointerCancel: _onPointerCancel,
      child: widget.child,
    );
  }

  @visibleForTesting
  void onPointerDown(PointerDownEvent event) => _onPointerDown(event);

  void _onPointerDown(PointerDownEvent event) {
    try {
      _lastPointerId = event.pointer;
      _lastPointerDownLocation = event.position;
      _pointerDownTime = event.timeStamp;
    } catch (exception, stacktrace) {
      _logError('onPointerDown', exception, stacktrace);
    }
  }

  @visibleForTesting
  void onPointerUp(
          PointerUpEvent event, double devicePixelRatio, Size screenSize) =>
      _onPointerUp(event, devicePixelRatio, screenSize);

  void _onPointerUp(
      PointerUpEvent event, double devicePixelRatio, Size screenSize) {
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
          _handleLongClick(event.position, downTime, event.timeStamp,
              devicePixelRatio, screenSize);
        } else {
          _handleClick(event.position, devicePixelRatio, screenSize);
        }
      }

      if (_isScrolling) {
        _handleScrollEnd(event.position, delta, devicePixelRatio);
      }

      _resetPointerState();
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
    _lastPointerId = null;
    _lastPointerDownLocation = null;
    _pointerDownTime = null;
    _isScrolling = false;
  }

  void _handleClick(Offset position, double devicePixelRatio, Size screenSize) {
    final screenBounds =
        Rect.fromLTWH(0, 0, screenSize.width, screenSize.height);

    final result = LayoutSnapshotCapture.capture(
      _clickTrackerElement,
      screenBounds: screenBounds,
      detectionPosition: position,
      detectionMode: GestureDetectionMode.click,
      widgetFilter: Measure.instance.getLayoutSnapshotWidgetFilter(),
    );

    if (result != null) {
      // Check if we detected a clickable element
      if (result.gestureElement == null || result.gestureElementType == null) {
        _log(LogLevel.debug,
            "No clickable element found at ${position.toString()}");
        return;
      }

      widget
          .onClick(
        ClickData(
          target: result.gestureElementType!,
          x: (position.dx * devicePixelRatio).roundToDouble(),
          y: (position.dy * devicePixelRatio).roundToDouble(),
          targetId: null,
          touchDownTime: null,
          touchUpTime: null,
          width: result.gestureElement?.size?.width.toInt(),
          height: result.gestureElement?.size?.height.toInt(),
        ),
        result.snapshot,
      )
          .catchError((error, stackTrace) {
        _logError('onClick', error, stackTrace);
      });
    }
  }

  void _handleLongClick(
    Offset position,
    Duration downTime,
    Duration upTime,
    double devicePixelRatio,
    Size screenSize,
  ) {
    final screenBounds =
        Rect.fromLTWH(0, 0, screenSize.width, screenSize.height);
    final result = LayoutSnapshotCapture.capture(
      _clickTrackerElement,
      detectionPosition: position,
      detectionMode: GestureDetectionMode.click,
      widgetFilter: Measure.instance.getLayoutSnapshotWidgetFilter(),
      screenBounds: screenBounds,
    );

    if (result == null ||
        result.gestureElement == null ||
        result.gestureElementType == null) {
      _log(LogLevel.debug,
          "No clickable element found at ${position.toString()}");
      return;
    }

    widget
        .onLongClick(
      LongClickData(
        target: result.gestureElementType!,
        x: (position.dx * devicePixelRatio).roundToDouble(),
        y: (position.dy * devicePixelRatio).roundToDouble(),
        targetId: null,
        touchDownTime: null,
        touchUpTime: null,
        width: result.gestureElement?.size?.width.toInt(),
        height: result.gestureElement?.size?.height.toInt(),
      ),
      result.snapshot,
    )
        .catchError((error, stackTrace) {
      _logError('onLongClick', error, stackTrace);
    });
  }

  void _handleScrollEnd(
      Offset position, Offset delta, double devicePixelRatio) {
    final (scrollableElement, scrollableType) =
        _findScrollableElement(position);

    if (scrollableElement == null || scrollableType == null) {
      return;
    }

    final scrollAxis = _findScrollAxis(scrollableElement.widget);
    final scrollDirection = _findScrollDirection(delta);
    final isValidScroll = _validateScroll(scrollAxis, scrollDirection);
    if (!isValidScroll) {
      return;
    }

    widget
        .onScroll(
      ScrollData(
        target: scrollableType,
        x: ((position.dx - delta.dx) * devicePixelRatio).roundToDouble(),
        y: ((position.dy - delta.dy) * devicePixelRatio).roundToDouble(),
        endX: (position.dx * devicePixelRatio).roundToDouble(),
        endY: (position.dy * devicePixelRatio).roundToDouble(),
        targetId: null,
        direction: scrollDirection,
        touchDownTime: null,
        touchUpTime: null,
      ),
    )
        .catchError((error, stackTrace) {
      _logError('onScroll', error, stackTrace);
    });
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

  /// Finds a scrollable element at the given position.
  (Element?, String?) _findScrollableElement(Offset position) {
    if (_clickTrackerElement == null) {
      return (null, null);
    }

    Element? foundElement;
    String? foundType;

    void traverse(Element element) {
      final renderObject = element.renderObject;
      if (renderObject == null ||
          renderObject is! RenderBox ||
          !renderObject.hasSize) {
        element.visitChildElements(traverse);
        return;
      }
      final scrollableType = getScrollableWidgetName(element.widget);
      if (scrollableType != null) {
        if (_hitTest(element, position, _clickTrackerElement!)) {
          foundElement = element;
          foundType = scrollableType;
        }
      }
      element.visitChildElements(traverse);
    }

    traverse(_clickTrackerElement!);
    return (foundElement, foundType);
  }

  /// Performs hit test to check if position is within element bounds
  bool _hitTest(Element element, Offset position, Element rootElement) {
    final renderObject = element.renderObject;
    if (renderObject == null ||
        (renderObject is RenderBox && !renderObject.hasSize)) {
      return false;
    }
    try {
      final transform = renderObject.getTransformTo(rootElement.renderObject);
      final transformedBounds =
          MatrixUtils.transformRect(transform, renderObject.paintBounds);
      return transformedBounds.contains(position);
    } catch (e) {
      return false;
    }
  }

  void _log(LogLevel level, String message) {
    log(message);
  }

  void _logError(String method, Object exception, StackTrace stackTrace) {
    log("Error tracking gesture $method: $exception",
        error: exception, stackTrace: stackTrace);
  }
}
