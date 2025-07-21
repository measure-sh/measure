import 'package:flutter/material.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/screenshot/screenshot_collector.dart';

import 'gestures/msr_gesture_detector.dart';

/// A wrapper widget that enables automatic gesture tracking and screenshot capture.
/// 
/// [MeasureWidget] should wrap your app's root widget to enable automatic
/// tracking of user interactions (taps, long presses, scrolls) and provide
/// screenshot capture capabilities for bug reports.
/// 
/// **Features:**
/// - Automatic gesture tracking (clicks, long presses, scrolls)
/// - Screenshot capture capability via [RepaintBoundary]
/// - Seamless integration with bug reporting
/// 
/// **Usage:**
/// ```dart
/// class MyApp extends StatelessWidget {
///   @override
///   Widget build(BuildContext context) {
///     return MeasureWidget(
///       child: MaterialApp(
///         navigatorObservers: [MsrNavigatorObserver()],
///         home: HomeScreen(),
///       ),
///     );
///   }
/// }
/// ```
/// 
/// **Note:** Place [MeasureWidget] as high as possible in your widget tree
/// to capture the maximum screen area for screenshots and gesture tracking.
class MeasureWidget extends StatefulWidget {
  final Widget child;

  const MeasureWidget({
    super.key,
    required this.child,
  });

  @override
  State<MeasureWidget> createState() => _MeasureWidgetState();
}

class _MeasureWidgetState extends State<MeasureWidget> {
  late GlobalKey _repaintBoundaryKey;

  @override
  void initState() {
    super.initState();
    _repaintBoundaryKey = screenshotKey;
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      key: _repaintBoundaryKey,
      child: MsrGestureDetector(
        child: widget.child,
        onClick: (clickData) => Measure.instance.trackClick(clickData),
        onLongClick: (longClickData) =>
            Measure.instance.trackLongClick(longClickData),
        onScroll: (scrollData) => Measure.instance.trackScroll(scrollData),
      ),
    );
  }
}
