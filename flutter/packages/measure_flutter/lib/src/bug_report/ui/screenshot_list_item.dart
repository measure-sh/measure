import 'dart:io';

import 'package:flutter/material.dart';
import 'package:measure_flutter/src/bug_report/ui/delete_screenshot_button.dart';
import 'package:measure_flutter/src/events/msr_attachment.dart';

class ScreenshotListItem extends StatefulWidget {
  final MsrAttachment screenshot;
  final VoidCallback onDelete;

  const ScreenshotListItem({
    super.key,
    required this.screenshot,
    required this.onDelete,
  });

  @override
  State<ScreenshotListItem> createState() => _ScreenshotListItemState();
}

class _ScreenshotListItemState extends State<ScreenshotListItem> {
  bool _isImageLoaded = false;

  Widget _buildImageContainer(Widget child) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Colors.grey.shade400,
          width: 1,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: child,
      ),
    );
  }

  Widget _buildFrameBuilder(BuildContext context, Widget child, int? frame,
      bool wasSynchronouslyLoaded) {
    final container = _buildImageContainer(child);

    // Mark image as loaded when frame is available or loaded synchronously
    final bool shouldShowButton = frame != null || wasSynchronouslyLoaded;
    if (shouldShowButton && !_isImageLoaded) {
      // Use a microtask to avoid calling setState during build
      Future.microtask(() {
        if (mounted) {
          setState(() {
            _isImageLoaded = true;
          });
        }
      });
    }

    if (wasSynchronouslyLoaded) {
      return container;
    }

    return AnimatedOpacity(
      opacity: frame == null ? 0 : 1,
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOut,
      child: container,
    );
  }

  @override
  Widget build(BuildContext context) {
    final Widget image;

    if (widget.screenshot.path != null) {
      image = Image.file(
        File(widget.screenshot.path!),
        fit: BoxFit.cover,
        frameBuilder: _buildFrameBuilder,
      );
    } else if (widget.screenshot.bytes != null) {
      image = Image.memory(
        widget.screenshot.bytes!,
        fit: BoxFit.cover,
        frameBuilder: _buildFrameBuilder,
      );
    } else {
      image = const SizedBox.shrink();
    }

    return Stack(
      children: [
        Padding(
          padding: const EdgeInsets.only(right: 20, top: 20, left: 8),
          child: image,
        ),
        Positioned(
          top: 0,
          right: 0,
          child: AnimatedOpacity(
            opacity: _isImageLoaded ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            child: DeleteScreenshotButton(onDelete: widget.onDelete),
          ),
        ),
      ],
    );
  }
}