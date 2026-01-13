import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:measure_flutter/src/bug_report/shake_detector.dart';
import 'package:measure_flutter/src/bug_report/ui/image_picker.dart';
import 'package:measure_flutter/src/bug_report/ui/platform_wrapper.dart';
import 'package:measure_flutter/src/bug_report/ui/send_button.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

import '../../../measure_flutter.dart';
import '../../config/config_provider.dart';
import '../../logger/logger.dart';
import 'add_image_button.dart';
import 'bug_report_input.dart';
import 'bug_report_state.dart';
import 'screenshot_list_item.dart';

class BugReport extends StatefulWidget {
  final MsrAttachment? initialScreenshot;
  final Map<String, AttributeValue>? attributes;
  final BugReportTheme theme;
  final Logger logger;
  final ConfigProvider configProvider;
  final IdProvider idProvider;
  final ImagePickerWrapper imagePicker;
  final ShakeDetector shakeDetector;

  const BugReport({
    super.key,
    required this.logger,
    required this.configProvider,
    required this.idProvider,
    required this.imagePicker,
    required this.shakeDetector,
    this.initialScreenshot,
    this.attributes,
    this.theme = const BugReportTheme(),
  });

  @override
  State<StatefulWidget> createState() => _BugReportState();
}

class _BugReportState extends State<BugReport> {
  final TextEditingController textController = TextEditingController();
  late ScreenshotsState screenshotsState;
  bool _isLoadingImages = false;

  @override
  void initState() {
    super.initState();
    widget.shakeDetector.setBugReportFlowActive();
    screenshotsState = ScreenshotsState();
    screenshotsState.initializeWithScreenshot(widget.initialScreenshot);
  }

  @override
  void dispose() {
    widget.shakeDetector.setBugReportFlowInactive();
    screenshotsState.dispose();
    super.dispose();
  }

  bool _shouldEnableSendButton() =>
      screenshotsState.hasScreenshots || textController.text.trim().isNotEmpty;

  void _showMessage(String message) {
    final theme = Theme.of(context);
    final bugReportTheme = widget.theme;

    if (theme.platform == TargetPlatform.iOS) {
      showCupertinoDialog(
        context: context,
        builder: (context) => CupertinoAlertDialog(
          content: Text(
            message,
            style: theme.textTheme.bodyMedium,
          ),
          actions: [
            CupertinoDialogAction(
              child: Text(
                'OK',
                style: TextStyle(
                  color: bugReportTheme.colors.primaryColor ??
                      theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            message,
            style: theme.snackBarTheme.contentTextStyle ??
                theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onInverseSurface,
                ),
          ),
          backgroundColor: theme.snackBarTheme.backgroundColor ??
              theme.colorScheme.inverseSurface,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(milliseconds: 1500),
          shape: theme.snackBarTheme.shape ??
              RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
        ),
      );
    }
  }

  void _trackBugReport() {
    final description = textController.text;
    final screenshots = screenshotsState.screenshots;
    final attributes = widget.attributes ?? {};

    // Let the user continue using the app, as
    // the track bug report method can take time to complete
    // as it needs to compress all images.
    Navigator.pop(context);

    Measure.instance.trackBugReport(
      description: description,
      attachments: screenshots,
      attributes: attributes,
    );
  }

  Future<void> _pickImageFromGallery() async {
    final limit = widget.configProvider.maxAttachmentsInBugReport;
    final remainingSlots = limit - screenshotsState.screenshots.length;

    if (remainingSlots == 0) {
      _showMessage('Maximum $limit screenshots allowed');
      return;
    }

    setState(() {
      _isLoadingImages = true;
    });

    try {
      final screenshots =
          await widget.imagePicker.pickImagesFromGallery(remainingSlots);
      if (screenshots.isNotEmpty) {
        screenshotsState.addScreenshots(screenshots);
      }
    } catch (e) {
      widget.logger.log(LogLevel.error, "Error picking images from gallery", e);
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingImages = false;
        });
      }
    }
  }

  Widget _buildBody() {
    return SafeArea(
      child: LayoutBuilder(builder: (context, constraints) {
        final shouldHideBottom = constraints.maxHeight < 240;
        final maxBottomHeight = constraints.maxHeight * 0.3;
        return Column(
          children: [
            Expanded(
              child: BugReportInput(
                configProvider: widget.configProvider,
                controller: textController,
                theme: widget.theme,
              ),
            ),
            if (!shouldHideBottom) ...[
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: maxBottomHeight,
                ),
                child: ListenableBuilder(
                    listenable: screenshotsState,
                    builder: (context, _) {
                      return ListView.builder(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        scrollDirection: Axis.horizontal,
                        itemCount: screenshotsState.screenshots.length,
                        itemBuilder: (BuildContext context, int index) {
                          return ScreenshotListItem(
                            screenshot: screenshotsState.screenshots[index],
                            onDelete: () =>
                                screenshotsState.removeScreenshot(index),
                          );
                        },
                      );
                    }),
              ),
              AddImageButton(
                onPressed: _pickImageFromGallery,
                theme: widget.theme,
                isLoading: _isLoadingImages,
              ),
            ],
          ],
        );
      }),
    );
  }

  Widget _buildAndroidScaffold(Widget scaffoldBody) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final bugReportTheme = widget.theme;
    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        surfaceTintColor: colorScheme.surfaceTint,
        title: Text(
          bugReportTheme.text.appBarTitle,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w600,
            color: colorScheme.onSurface,
          ),
        ),
        centerTitle: true,
        actions: [
          ListenableBuilder(
            listenable: Listenable.merge(
              [screenshotsState, textController],
            ),
            builder: (_, __) => SendButton(
              bugReportTheme: bugReportTheme,
              onSend: _trackBugReport,
              enabled: _shouldEnableSendButton(),
            ),
          ),
        ],
      ),
      body: scaffoldBody,
    );
  }

  Widget _buildIOSScaffold(Widget scaffoldBody) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final bugReportTheme = widget.theme;
    return Material(
      child: CupertinoPageScaffold(
        backgroundColor: colorScheme.surface,
        navigationBar: CupertinoNavigationBar(
          backgroundColor: colorScheme.surface,
          border: Border(
            bottom: BorderSide(
              // ignore: deprecated_member_use
              color: colorScheme.outline.withOpacity(0.2),
              width: 0.5,
            ),
          ),
          middle: Text(
            bugReportTheme.text.appBarTitle,
            style: theme.textTheme.titleLarge?.copyWith(
              color: colorScheme.onSurface,
              fontWeight: FontWeight.w600,
            ),
          ),
          trailing: ListenableBuilder(
            listenable: Listenable.merge(
              [screenshotsState, textController],
            ),
            builder: (_, __) => SendButton(
              bugReportTheme: bugReportTheme,
              onSend: _trackBugReport,
              enabled: _shouldEnableSendButton(),
            ),
          ),
        ),
        child: scaffoldBody,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final body = _buildBody();
    return PlatformWidget(
      ios: _buildIOSScaffold(body),
      android: _buildAndroidScaffold(body),
    );
  }
}
