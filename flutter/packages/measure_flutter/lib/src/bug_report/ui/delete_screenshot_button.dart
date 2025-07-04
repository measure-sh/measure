import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:measure_flutter/src/bug_report/ui/platform_wrapper.dart';

import '../../../measure.dart';

class DeleteScreenshotButton extends StatelessWidget {
  final VoidCallback onDelete;
  final BugReportTheme? theme;

  const DeleteScreenshotButton({
    super.key,
    required this.onDelete,
    this.theme,
  });

  @override
  Widget build(BuildContext context) {
    final bugReportTheme = theme ?? const BugReportTheme();

    return Align(
      alignment: Alignment.topRight,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: PlatformWidget(
          ios: _buildIOSButton(context, bugReportTheme),
          android: _buildAndroidButton(context, bugReportTheme),
        ),
      ),
    );
  }

  Widget _buildIOSButton(BuildContext context, BugReportTheme bugReportTheme) {
    final materialTheme = Theme.of(context);

    return CupertinoButton(
      onPressed: onDelete,
      padding: EdgeInsets.zero,
      minSize: 28,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: materialTheme.colorScheme.surface.withValues(alpha: 0.9),
          shape: BoxShape.circle,
          border: Border.all(
            color: materialTheme.colorScheme.outline.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
        child: Icon(
          Icons.close,
          size: 16,
          color: materialTheme.colorScheme.onSurface,
        ),
      ),
    );
  }

  Widget _buildAndroidButton(
      BuildContext context, BugReportTheme bugReportTheme) {
    final materialTheme = Theme.of(context);

    return IconButton(
      onPressed: onDelete,
      icon: const Icon(Icons.close),
      style: IconButton.styleFrom(
        backgroundColor:
            materialTheme.colorScheme.surface.withValues(alpha: 0.9),
        foregroundColor: materialTheme.colorScheme.onSurface,
        padding: const EdgeInsets.all(4),
        minimumSize: const Size(28, 28),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        side: BorderSide(
          color: materialTheme.colorScheme.outline.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
    );
  }
}
