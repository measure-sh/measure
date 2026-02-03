import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:measure_flutter/src/bug_report/ui/platform_wrapper.dart';

import '../../../measure_flutter.dart';

class SendButton extends StatelessWidget {
  final BugReportTheme bugReportTheme;
  final VoidCallback onSend;
  final bool enabled;

  const SendButton({
    super.key,
    required this.bugReportTheme,
    required this.onSend,
    required this.enabled,
  });

  Widget _buildIOSButton(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return CupertinoButton(
      padding: EdgeInsets.zero,
      onPressed: enabled ? onSend : null,
      child: Text(
        bugReportTheme.text.sendButton,
        style: theme.textTheme.bodyLarge?.copyWith(
          color: enabled
              ? (bugReportTheme.colors.primaryColor ?? colorScheme.primary)
              // ignore: deprecated_member_use
              : (bugReportTheme.colors.primaryColor ?? colorScheme.primary).withOpacity(.4),
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildAndroidButton(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return TextButton(
      onPressed: enabled ? onSend : null,
      style: TextButton.styleFrom(
        foregroundColor: enabled
            ? (bugReportTheme.colors.primaryColor ?? colorScheme.primary)
            // ignore: deprecated_member_use
            : (bugReportTheme.colors.primaryColor ?? colorScheme.primary).withOpacity(0.4),
        padding: const EdgeInsets.symmetric(horizontal: 16),
      ),
      child: Text(
        bugReportTheme.text.sendButton,
        style: theme.textTheme.bodyLarge?.copyWith(
          fontWeight: FontWeight.w600,
          color: enabled
              ? (bugReportTheme.colors.primaryColor ?? colorScheme.primary)
              : (bugReportTheme.colors.primaryColor ?? colorScheme.primary)
                  // ignore: deprecated_member_use
                  .withOpacity(0.4),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PlatformWidget(
      ios: _buildIOSButton(context),
      android: _buildAndroidButton(context),
    );
  }
}
