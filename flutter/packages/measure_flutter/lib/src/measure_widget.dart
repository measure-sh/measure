import 'package:flutter/material.dart';
import 'package:measure_flutter/src/screenshot/screenshot_service.dart';

/// A widget that provides Measure a way to inject
/// instrumentation into the widget tree.
///
/// This widget adds a [RepaintBoundary] that is used to capture
/// screenshots of the widget tree.
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
      child: widget.child,
    );
  }
}
