import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:measure_flutter/measure_flutter.dart';
// ignore: implementation_imports
import 'package:measure_flutter/src/config/screenshot_mask_level.dart';
// ignore: implementation_imports
import 'package:measure_flutter/src/screenshot/screenshot_mask.dart';

const _maskColor = Color(0xFF222222);
const _maskRadius = 8.0;

final _sampleImage = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR42mPQqzXCihiGlgQAlgM3QYr963wAAAAASUVORK5CYII=',
);

class MaskingDemoPage extends StatefulWidget {
  const MaskingDemoPage({super.key});

  @override
  State<MaskingDemoPage> createState() => _MaskingDemoPageState();
}

class _MaskingDemoPageState extends State<MaskingDemoPage> {
  final GlobalKey _contentKey = GlobalKey();
  ScreenshotMaskLevel _level = ScreenshotMaskLevel.allTextAndMedia;
  bool _showMask = true;
  List<Rect> _rects = const [];

  @override
  void initState() {
    super.initState();
    _scheduleRecompute();
  }

  void _scheduleRecompute() {
    WidgetsBinding.instance.addPostFrameCallback((_) => _recompute());
  }

  void _recompute() {
    final context = _contentKey.currentContext;
    final boundary = context?.findRenderObject();
    if (context == null || boundary is! RenderRepaintBoundary) return;
    final rects = ScreenshotMask().findRectsToMask(
      boundary,
      context as Element,
      _level,
    );
    setState(() => _rects = rects);
  }

  void _onLevelChanged(ScreenshotMaskLevel? level) {
    if (level == null) return;
    setState(() => _level = level);
    _scheduleRecompute();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Screenshot Masking')),
      body: Column(
        children: [
          _Controls(
            level: _level,
            showMask: _showMask,
            onLevelChanged: _onLevelChanged,
            onShowMaskChanged: (value) {
              setState(() => _showMask = value);
              _scheduleRecompute();
            },
          ),
          const Divider(height: 1),
          Expanded(
            child: Stack(
              children: [
                RepaintBoundary(
                  key: _contentKey,
                  child: NotificationListener<ScrollNotification>(
                    onNotification: (_) {
                      if (_showMask) _scheduleRecompute();
                      return false;
                    },
                    child: const _SampleContent(),
                  ),
                ),
                if (_showMask)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: CustomPaint(painter: _MaskPainter(_rects)),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Controls extends StatelessWidget {
  final ScreenshotMaskLevel level;
  final bool showMask;
  final ValueChanged<ScreenshotMaskLevel?> onLevelChanged;
  final ValueChanged<bool> onShowMaskChanged;

  const _Controls({
    required this.level,
    required this.showMask,
    required this.onLevelChanged,
    required this.onShowMaskChanged,
  });

  static const _labels = {
    ScreenshotMaskLevel.allTextAndMedia: 'All text & media',
    ScreenshotMaskLevel.allText: 'All text',
    ScreenshotMaskLevel.allTextExceptClickable: 'All text except clickable',
    ScreenshotMaskLevel.sensitiveFieldsOnly: 'Sensitive fields only',
  };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Mask level'),
          const SizedBox(height: 4),
          DropdownButton<ScreenshotMaskLevel>(
            value: level,
            isExpanded: true,
            onChanged: onLevelChanged,
            items: [
              for (final entry in _labels.entries)
                DropdownMenuItem(value: entry.key, child: Text(entry.value)),
            ],
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Show mask overlay'),
            value: showMask,
            onChanged: onShowMaskChanged,
          ),
        ],
      ),
    );
  }
}

class _SampleContent extends StatelessWidget {
  const _SampleContent();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Account', style: theme.textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text('This paragraph is plain, non-interactive text.'),
          const SizedBox(height: 16),
          Row(
            children: [
              Image.memory(_sampleImage, width: 120, height: 80, fit: BoxFit.fill),
              const SizedBox(width: 12),
              const Expanded(child: Text('An image sits to the left.')),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              ElevatedButton(onPressed: () {}, child: const Text('Submit')),
              const SizedBox(width: 12),
              TextButton(onPressed: () {}, child: const Text('Cancel')),
            ],
          ),
          const SizedBox(height: 16),
          const TextField(
            decoration: InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: 12),
          const TextField(
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 12),
          const TextField(
            obscureText: true,
            decoration: InputDecoration(labelText: 'Password'),
          ),
          const SizedBox(height: 16),
          const Row(
            children: [
              MsrMask(child: FlutterLogo(size: 56)),
              SizedBox(width: 12),
              Expanded(
                child: Text('FlutterLogo wrapped in MsrMask is always masked.'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MaskPainter extends CustomPainter {
  final List<Rect> rects;
  const _MaskPainter(this.rects);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = _maskColor
      ..style = PaintingStyle.fill;
    for (final rect in rects) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(_maskRadius)),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_MaskPainter oldDelegate) => oldDelegate.rects != rects;
}
