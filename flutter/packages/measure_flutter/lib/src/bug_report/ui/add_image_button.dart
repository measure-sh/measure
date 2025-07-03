import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:measure_flutter/src/bug_report/ui/bug_report_theme.dart';
import 'package:measure_flutter/src/bug_report/ui/platform_wrapper.dart';

class AddImageButton extends StatelessWidget {
  final VoidCallback onPressed;
  final BugReportTheme theme;
  final bool isLoading;

  const AddImageButton({
    super.key,
    required this.onPressed,
    required this.theme,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final materialTheme = Theme.of(context);
    final bugReportTheme = theme;
    final colorScheme = materialTheme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: PlatformWidget(
          ios: _buildIOSButton(colorScheme, bugReportTheme),
          android: _buildAndroidButton(colorScheme, bugReportTheme),
        ),
      ),
    );
  }

  Widget _buildIOSButton(
      ColorScheme colorScheme, BugReportTheme bugReportTheme) {
    return CupertinoButton(
      onPressed: !isLoading ? onPressed : null,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      borderRadius: BorderRadius.circular(8),
      color: colorScheme.surfaceContainerHighest,
      child: Row(
        mainAxisSize: MainAxisSize.max,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (isLoading)
            SizedBox(
              width: 20,
              height: 20,
              child: CupertinoActivityIndicator(
                color: colorScheme.onSurface,
                radius: 10,
              ),
            )
          else
            Icon(
              CupertinoIcons.photo,
              color: colorScheme.onSurface,
              size: 20,
            ),
          const SizedBox(width: 8),
          Text(
            isLoading ? 'Loading...' : bugReportTheme.text.addFromGalleryButton,
            style: TextStyle(
              color: colorScheme.onSurface,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAndroidButton(
      ColorScheme colorScheme, BugReportTheme bugReportTheme) {
    return OutlinedButton(
      onPressed: !isLoading ? onPressed : null,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
        side: BorderSide(
          color: colorScheme.outline,
          width: 1,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        foregroundColor:
            bugReportTheme.colors.primaryColor ?? colorScheme.primary,
        minimumSize: const Size(0, 40),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.max,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (isLoading)
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(
                color: bugReportTheme.colors.primaryColor ?? colorScheme.primary,
                strokeWidth: 2,
              ),
            )
          else
            Icon(
              Icons.photo_library_outlined,
              color: bugReportTheme.colors.primaryColor ?? colorScheme.primary,
              size: 20,
            ),
          const SizedBox(width: 8),
          Text(
            isLoading ? 'Loading...' : bugReportTheme.text.addFromGalleryButton,
            style: TextStyle(
              color: bugReportTheme.colors.primaryColor ?? colorScheme.primary,
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
