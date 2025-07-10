import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/bug_report/ui/add_image_button.dart';
import 'package:measure_flutter/src/bug_report/ui/bug_report.dart';
import 'package:measure_flutter/src/bug_report/ui/bug_report_input.dart';
import 'package:measure_flutter/src/bug_report/ui/screenshot_list_item.dart';
import 'package:measure_flutter/src/logger/logger.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_id_provider.dart';
import '../utils/fake_image_picker_wrapper.dart';
import '../utils/fake_measure.dart';
import '../utils/fake_shake_detector.dart';
import '../utils/noop_logger.dart';
import '../utils/test_method_channel.dart';

void main() {
  group('BugReport Widget Tests', () {
    final Logger logger = NoopLogger();
    late FakeMeasure fakeMeasure;
    late FakeConfigProvider configProvider;
    late TestMethodChannel testMethodChannel;

    setUp(() {
      fakeMeasure = FakeMeasure();
      configProvider = FakeConfigProvider();
      testMethodChannel = TestMethodChannel();
    });

    tearDown(() {
      fakeMeasure.clear();
    });

    Widget createBugReportApp({
      MsrAttachment? screenshot,
      List<MsrAttachment>? screenshots,
      Map<String, AttributeValue>? attributes,
      BugReportTheme? theme,
      TargetPlatform platform = TargetPlatform.android,
      FakeImagePickerWrapper? imagePicker,
    }) {
      // If multiple screenshots provided, use only the first one as initial screenshot
      // since BugReport only accepts single initial screenshot
      final initialScreenshot =
          screenshots?.isNotEmpty == true ? screenshots!.first : screenshot;

      return MaterialApp(
        theme: ThemeData(platform: platform),
        home: BugReport(
          initialScreenshot: initialScreenshot,
          attributes: attributes,
          theme: theme ?? const BugReportTheme(),
          logger: logger,
          configProvider: configProvider,
          idProvider: FakeIdProvider(),
          imagePicker: imagePicker ?? FakeImagePickerWrapper(),
          shakeDetector: FakeShakeDetector(),
        ),
      );
    }

    testWidgets('initializes with empty state', (tester) async {
      await tester.pumpWidget(createBugReportApp());

      expect(find.text('Report a Bug'), findsOneWidget);
      expect(find.text('Send'), findsOneWidget);
      expect(find.text('Add from Gallery'), findsOneWidget);
      expect(find.byType(BugReportInput), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      expect(find.byType(ListView), findsOneWidget);
    });

    testWidgets('send button is disabled in empty state on Android',
        (tester) async {
      await tester.pumpWidget(
        createBugReportApp(platform: TargetPlatform.android),
      );
      final sendButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Send'),
      );
      expect(sendButton.onPressed, isNull);
    });

    testWidgets('send button is disabled in empty state on iOS',
        (tester) async {
      await tester.pumpWidget(
        createBugReportApp(platform: TargetPlatform.iOS),
      );
      final sendButton = tester.widget<CupertinoButton>(
        find.widgetWithText(CupertinoButton, 'Send'),
      );
      expect(sendButton.onPressed, isNull);
    });

    testWidgets('initializes with initial screenshot', (tester) async {
      final initialScreenshot = MsrAttachment(
        name: 'initial.png',
        path: '/fake/path/initial.png',
        type: AttachmentType.screenshot,
        id: 'initial',
        size: 100,
      );

      await tester
          .pumpWidget(createBugReportApp(screenshot: initialScreenshot));

      expect(find.byType(ScreenshotListItem), findsOneWidget);
    });

    testWidgets('send button enables when text is entered', (tester) async {
      await tester.pumpWidget(createBugReportApp());

      var sendButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Send'),
      );
      expect(sendButton.enabled, false);

      await tester.enterText(find.byType(TextField), 'Bug description');
      await tester.pump();

      sendButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Send'),
      );
      expect(sendButton.enabled, true);
    });

    testWidgets('send button disables when text is cleared', (tester) async {
      await tester.pumpWidget(createBugReportApp());

      await tester.enterText(find.byType(TextField), 'Bug description');
      await tester.pump();

      var sendButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Send'),
      );
      expect(sendButton.enabled, true);

      await tester.enterText(find.byType(TextField), '');
      await tester.pump();

      sendButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Send'),
      );
      expect(sendButton.enabled, false);
    });

    testWidgets('send button disables with only whitespace', (tester) async {
      await tester.pumpWidget(createBugReportApp());

      await tester.enterText(find.byType(TextField), '   ');
      await tester.pump();

      final sendButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Send'),
      );
      expect(sendButton.enabled, false);
    });

    testWidgets('can send with only screenshot, no text', (tester) async {
      final initialScreenshot = MsrAttachment(
        name: 'initial.png',
        path: '/fake/path/initial.png',
        type: AttachmentType.screenshot,
        id: 'initial',
        size: 100,
      );

      await tester
          .pumpWidget(createBugReportApp(screenshot: initialScreenshot));

      final sendButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Send'),
      );
      expect(sendButton.enabled, true);
    });

    testWidgets('closes screen after sending bug report', (tester) async {
      final measure = Measure.withMethodChannel(testMethodChannel);
      await measure.init(
        () {},
        clientInfo: ClientInfo(
          apiKey: "msrsh-123",
          apiUrl: "https://example.com",
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => BugReport(
                      logger: logger,
                      configProvider: configProvider,
                      idProvider: FakeIdProvider(),
                      imagePicker: FakeImagePickerWrapper(),
                      shakeDetector: FakeShakeDetector(),
                    ),
                  ),
                ),
                child: const Text('Open Bug Report'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Bug Report'));
      await tester.pumpAndSettle();

      expect(find.text('Report a Bug'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Test bug');
      await tester.pump();

      await tester.tap(find.widgetWithText(TextButton, 'Send'));
      await tester.pumpAndSettle();

      expect(find.text('Report a Bug'), findsNothing);
      expect(find.text('Open Bug Report'), findsOneWidget);
    });

    testWidgets('shows add image button when height allows', (tester) async {
      await tester.pumpWidget(createBugReportApp());

      expect(find.byType(AddImageButton), findsOneWidget);
    });

    testWidgets('hides bottom section when height is too small',
        (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 200));

      await tester.pumpWidget(createBugReportApp());

      expect(find.byType(AddImageButton), findsNothing);

      await tester.binding.setSurfaceSize(null);
    });

    testWidgets('uses custom theme from colors if provided', (tester) async {
      const customTheme = BugReportTheme(
        colors: BugReportColors(
          primaryColor: Colors.purple,
        ),
      );

      await tester.pumpWidget(createBugReportApp(theme: customTheme));

      // Enable the send button by entering text
      await tester.enterText(find.byType(TextField), 'Test bug');
      await tester.pump();

      final sendButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Send'),
      );

      final buttonStyle = sendButton.style;
      expect(buttonStyle?.foregroundColor?.resolve({}), Colors.purple);
    });

    testWidgets('uses custom text from theme if provided', (tester) async {
      const customTheme = BugReportTheme(
        text: BugReportText(
          appBarTitle: 'Custom Bug Report',
          sendButton: 'Custom Send Report',
          inputPlaceHolder: 'Custom enter bug details here...',
          addFromGalleryButton: 'Custom add Images',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: BugReport(
            theme: customTheme,
            logger: logger,
            configProvider: configProvider,
            idProvider: FakeIdProvider(),
            imagePicker: FakeImagePickerWrapper(),
            shakeDetector: FakeShakeDetector(),
          ),
        ),
      );

      // Verify custom text is displayed
      expect(find.text('Custom Bug Report'), findsOneWidget);
      expect(find.text('Custom Send Report'), findsOneWidget);
      expect(find.text('Custom enter bug details here...'), findsOneWidget);
      expect(find.text('Custom add Images'), findsOneWidget);
    });

    testWidgets('shows loading state when picking images', (tester) async {
      final fakeImagePicker = FakeImagePickerWrapper();
      fakeImagePicker.delay = const Duration(milliseconds: 100);

      await tester.pumpWidget(createBugReportApp(imagePicker: fakeImagePicker));

      // Initially should show normal button
      expect(find.text('Add from Gallery'), findsOneWidget);
      expect(find.text('Loading...'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);

      // Tap the add image button
      await tester.tap(find.byType(AddImageButton));
      await tester.pump(); // Trigger the loading state

      // Should now show loading state
      expect(find.text('Loading...'), findsOneWidget);
      expect(find.text('Add from Gallery'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Verify button is disabled during loading
      final addImageButton =
          tester.widget<AddImageButton>(find.byType(AddImageButton));
      expect(addImageButton.isLoading, isTrue);

      // Wait for the async operation to complete
      await tester.pumpAndSettle();

      // Should return to normal state after completion
      expect(find.text('Add from Gallery'), findsOneWidget);
      expect(find.text('Loading...'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('shows loading state when picking images on iOS',
        (tester) async {
      final fakeImagePicker = FakeImagePickerWrapper();
      fakeImagePicker.delay = const Duration(milliseconds: 100);

      await tester.pumpWidget(createBugReportApp(
        platform: TargetPlatform.iOS,
        imagePicker: fakeImagePicker,
      ));

      // Initially should show normal button
      expect(find.text('Add from Gallery'), findsOneWidget);
      expect(find.text('Loading...'), findsNothing);
      expect(find.byType(CupertinoActivityIndicator), findsNothing);

      // Tap the add image button
      await tester.tap(find.byType(AddImageButton));
      await tester.pump(); // Trigger the loading state

      // Should now show loading state with iOS indicator
      expect(find.text('Loading...'), findsOneWidget);
      expect(find.text('Add from Gallery'), findsNothing);
      expect(find.byType(CupertinoActivityIndicator), findsOneWidget);

      // Wait for the async operation to complete
      await tester.pumpAndSettle();

      // Should return to normal state after completion
      expect(find.text('Add from Gallery'), findsOneWidget);
      expect(find.text('Loading...'), findsNothing);
      expect(find.byType(CupertinoActivityIndicator), findsNothing);
    });
  });
}
