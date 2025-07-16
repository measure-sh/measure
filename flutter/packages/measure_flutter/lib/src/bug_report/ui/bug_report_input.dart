import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:measure_flutter/src/bug_report/ui/bug_report_theme.dart';
import 'package:measure_flutter/src/bug_report/ui/platform_wrapper.dart';
import 'package:measure_flutter/src/config/config_provider.dart';

/// Text input widget for bug report descriptions.
class BugReportInput extends StatefulWidget {
  final ConfigProvider configProvider;
  final TextEditingController? controller;
  final BugReportTheme? theme;

  const BugReportInput({
    super.key,
    required this.configProvider,
    this.controller,
    this.theme,
  });

  @override
  State<StatefulWidget> createState() {
    return _BugReportInput();
  }
}

class _BugReportInput extends State<BugReportInput> {
  late TextEditingController textController;
  final FocusNode focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    textController = widget.controller ?? TextEditingController();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bugReportTheme = widget.theme ?? const BugReportTheme();
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(8),
      child: PlatformWidget(
        ios: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
          ),
          child: _buildIOSTextField(colorScheme, bugReportTheme),
        ),
        android: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
          ),
          child: _buildAndroidTextField(colorScheme, bugReportTheme),
        ),
      ),
    );
  }

  Widget _buildIOSTextField(
      ColorScheme colorScheme, BugReportTheme bugReportTheme) {
    return CupertinoTextField(
      controller: textController,
      focusNode: focusNode,
      maxLines: null,
      maxLength: widget.configProvider.maxDescriptionLengthInBugReport,
      expands: true,
      textAlignVertical: TextAlignVertical.top,
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(),
      placeholder: bugReportTheme.text.inputPlaceHolder,
      placeholderStyle: TextStyle(
        color: CupertinoColors.placeholderText,
        fontSize: 16,
        height: 1.4,
      ),
      style: TextStyle(
        fontSize: 16,
        height: 1.4,
        color: colorScheme.onSurface,
      ),
    );
  }

  Widget _buildAndroidTextField(
      ColorScheme colorScheme, BugReportTheme bugReportTheme) {
    return TextField(
      controller: textController,
      focusNode: focusNode,
      maxLines: null,
      expands: true,
      textAlignVertical: TextAlignVertical.top,
      decoration: InputDecoration(
        hintText: bugReportTheme.text.inputPlaceHolder,
        hintStyle: TextStyle(
          color: colorScheme.onSurfaceVariant,
          fontSize: 16,
          height: 1.4,
        ),
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        contentPadding: const EdgeInsets.all(16),
        filled: false,
      ),
      style: TextStyle(
        fontSize: 16,
        height: 1.4,
        color: colorScheme.onSurface,
      ),
    );
  }

  @override
  void dispose() {
    if (widget.controller == null) {
      textController.dispose();
    }
    focusNode.dispose();
    super.dispose();
  }
}

/// Multi-line text field for entering bug descriptions.
class BugDescriptionTextField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isIOS;

  const BugDescriptionTextField({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.isIOS,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    if (isIOS) {
      return CupertinoTextField(
        controller: controller,
        focusNode: focusNode,
        maxLines: null,
        expands: true,
        textAlignVertical: TextAlignVertical.top,
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(),
        placeholder: 'Briefly describe the issue you are facing',
        placeholderStyle: TextStyle(
          color: CupertinoColors.placeholderText,
          fontSize: 16,
          height: 1.4,
        ),
        style: TextStyle(
          fontSize: 16,
          height: 1.4,
          color: colorScheme.onSurface,
        ),
      );
    }

    return TextField(
      controller: controller,
      focusNode: focusNode,
      maxLines: null,
      expands: true,
      textAlignVertical: TextAlignVertical.top,
      decoration: InputDecoration(
        hintText: 'Briefly describe the issue you are facing',
        hintStyle: TextStyle(
          color: colorScheme.onSurfaceVariant,
          fontSize: 16,
          height: 1.4,
        ),
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        contentPadding: const EdgeInsets.all(16),
        filled: false,
      ),
      style: TextStyle(
        fontSize: 16,
        height: 1.4,
        color: colorScheme.onSurface,
      ),
    );
  }
}
