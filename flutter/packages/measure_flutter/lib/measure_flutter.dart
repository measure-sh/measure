/// Flutter SDK for measure.sh
///
/// Measure is an open source tool to monitor mobile apps, this package contains
/// the Flutter SDK which helps instrumenting your app easily.
///
/// ## Integration
///
/// ### Install the SDK
///
/// Add the following dependency to your `pubspec.yaml` file:
///
/// ```yaml
/// dependencies:
///   measure_flutter: ^0.1.0
/// ```
///
/// ### Initialize the SDK
///
/// To initialize the SDK, you need to call the `Measure.instance.init` method in your `main` function
/// and wrap your application with `MeasureWidget` as the parent.
///
/// ```dart
/// Future<void> main() async {
///   await Measure.instance.init(
///         () =>
///         runApp(
///           MeasureWidget(child: MyApp()),
///         ),
///     config: const MeasureConfig(
///       enableLogging: true,
///       traceSamplingRate: 1,
///       samplingRateForErrorFreeSessions: 1,
///     ),
///     clientInfo: ClientInfo(
///       apiKey: "YOUR_API_KEY",
///       apiUrl: "YOUR_API_URL",
///     ),
///   );
/// }
/// ```
///
/// ### Verify Installation
///
/// Launch the app with the SDK integrated and navigate through a few screens. The data is sent to the server periodically,
/// so it may take a few seconds to appear. Checkout the `Usage` section in the dashboard or navigate to the `Sessions` tab
/// to see the sessions being tracked.
///
/// ## Track screen views
///
/// To hook up with the Flutter navigation system, use the [MsrNavigatorObserver] which automatically
/// tracks screen views when navigating between screens. You can add it to your `MaterialApp` or
/// `CupertinoApp` as follows:
///
/// ```dart
/// @override
/// Widget build(BuildContext context) {
///   return MaterialApp(
///     navigatorObservers: [MsrNavigatorObserver()],
///     home: HomeScreen(),
///   );
/// }
/// ```
///
/// To manually track screen views in a Flutter application, you can use the `trackScreenViewEvent` method:
///
/// ```dart
/// Measure.instance.trackScreenViewEvent(name: "Home");
/// ```
///
/// ## Track http events
///
/// Network requests made using the Dio package can be tracked by adding the `measure_dio` package to your
/// project. This package provides `MsrInterceptor` that can automatically track network requests done
/// using Dio.
///
/// ```dart
/// final dio = Dio();
/// dio.interceptors.add(MsrInterceptor());
/// ```
///
/// For any other HTTP client libraries, you can manually track network requests using the
/// [trackHttpEvent] method.
///
/// ## Checkout detailed documentation
///
/// Checkout the [documentation](https://github.com/measure-sh/measure/tree/main/docs) to learn more
/// about Measure.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/measure_initializer.dart';
import 'package:measure_flutter/src/measure_internal.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

import 'measure_flutter.dart';

export 'src/attribute_builder.dart';
export 'src/attribute_value.dart';
export 'src/bug_report/msr_shake_detector_mixin.dart';
export 'src/bug_report/ui/bug_report_theme.dart';
export 'src/config/client.dart';
export 'src/config/measure_config.dart';
export 'src/events/attachment_type.dart';
export 'src/events/msr_attachment.dart';
export 'src/http/http_method.dart';
export 'src/measure_api.dart';
export 'src/measure_widget.dart';
export 'src/navigation/navigator_observer.dart';
export 'src/tracing/span.dart';
export 'src/tracing/span_builder.dart';
export 'src/tracing/span_status.dart';

/// This singleton class serves as the primary entry point for all SDK
/// functionality.
///
/// Access the singleton instance via [Measure.instance]:
class Measure implements MeasureApi {
  Measure._();

  /// Named constructor for testing with injectable method channel
  @visibleForTesting
  Measure.withMethodChannel(this._methodChannel);

  /// The singleton instance of the Measure SDK.
  ///
  /// Use this instance to access all SDK functionality:
  /// ```dart
  /// await Measure.instance.init(...);  // Initialize
  /// Measure.instance.trackEvent(...); // Track custom events
  /// Measure.instance.start();         // Start data collection
  /// ```
  static final Measure instance = Measure._();

  late MeasureInternal _measure;
  bool _isInitialized = false;
  MsrMethodChannel? _methodChannel;

  /// Whether the SDK has been successfully initialized.
  ///
  /// Returns `true` if [init] has completed successfully, `false` otherwise.
  /// Most SDK methods will be no-ops if called before initialization.
  @visibleForTesting
  bool get isInitialized => _isInitialized;

  /// Initializes the Measure SDK with the provided configuration.
  ///
  /// This method must be called before using any other SDK functionality.
  /// It sets up error handling, initializes the native SDK, and runs the
  /// provided [action] function (typically your app's main entry point).
  ///
  /// **Parameters:**
  /// - [action]: A function to execute after initialization (usually `runApp`)
  /// - [clientInfo]: Required authentication and endpoint configuration
  /// - [config]: Optional SDK configuration with sensible defaults
  ///
  /// **Example:**
  /// ```dart
  /// await Measure.instance.init(() async {
  ///   runApp(MyApp());
  /// },
  /// clientInfo: ClientInfo(
  ///   apiKey: 'your-measure-api-key',
  ///   apiUrl: 'https://api.measure.sh',
  /// ),
  /// config: MeasureConfig(
  ///   enableLogging: true,
  ///   trackHttpHeaders: true,
  /// ));
  /// ```
  ///
  /// **Note:** If initialization fails, the error will be logged but [action]
  /// will still be executed to prevent blocking your app startup.
  @override
  Future<void> init(
    FutureOr<void> Function() action, {
    required ClientInfo clientInfo,
    MeasureConfig config = const MeasureConfig(),
  }) async {
    WidgetsFlutterBinding.ensureInitialized();
    if (_validateClientInfo(clientInfo)) {
      try {
        await _initializeMeasureSDK(config, clientInfo);
        _isInitialized = true;
        _logInitializationSuccess();
        await _setupErrorHandling();
      } catch (e, stackTrace) {
        _logInitializationFailure(config.enableLogging, e, stackTrace);
      }
    }
    return action();
  }

  /// Starts data collection and event tracking.
  ///
  /// By default, the SDK automatically starts collecting data after
  /// initialization. Call this method to manually start data collection
  /// if you set `autoStart: false` in [MeasureConfig], or after calling [stop].
  ///
  /// **Example:**
  /// ```dart
  /// // Initialize with manual start
  /// await Measure.instance.init(..., config: MeasureConfig(autoStart: false));
  ///
  /// // Later, start data collection when appropriate
  /// await Measure.instance.start();
  /// ```
  ///
  /// This method is safe to call multiple times - subsequent calls are no-ops.
  @override
  Future<void> start() async {
    if (isInitialized) {
      return _measure.start();
    }
  }

  /// Stops data collection and event tracking.
  ///
  /// Use this method to temporarily pause data collection, for example
  /// during sensitive user flows or when the user opts out of analytics.
  /// Call [start] to resume data collection.
  ///
  /// **Example:**
  /// ```dart
  /// // Stop tracking during sensitive operations
  /// await Measure.instance.stop();
  /// performSensitiveOperation();
  /// await Measure.instance.start(); // Resume tracking
  /// ```
  ///
  /// This method is safe to call multiple times - subsequent calls are no-ops.
  @override
  Future<void> stop() async {
    if (isInitialized) {
      return _measure.stop();
    }
  }

  /// Determines if HTTP requests to the given URL should be tracked.
  ///
  /// This method checks the configured URL allow/block lists to determine
  /// if requests to [url] should be automatically tracked by the SDK.
  ///
  /// **Parameters:**
  /// - [url]: The URL to check for tracking eligibility
  ///
  /// **Returns:** `true` if the URL should be tracked, `false` otherwise
  ///
  /// **Example:**
  /// ```dart
  /// if (Measure.instance.shouldTrackHttpUrl('https://api.example.com')) {
  ///   // This URL will be automatically tracked
  /// }
  /// ```
  ///
  /// See [MeasureConfig.httpUrlAllowlist] and [MeasureConfig.httpUrlBlocklist]
  /// for configuration options.
  @override
  bool shouldTrackHttpUrl(String url) {
    if (isInitialized) {
      return _measure.configProvider.shouldTrackHttpUrl(url);
    }
    return false;
  }

  /// Determines if the HTTP header with the given key should be tracked.
  ///
  /// This method checks if the header [key] is allowed to be captured
  /// based on the configured header block list and security policies.
  /// Sensitive headers like "Authorization" are always blocked.
  ///
  /// **Parameters:**
  /// - [key]: The HTTP header name to check
  ///
  /// **Returns:** `true` if the header should be captured, `false` otherwise
  ///
  /// **Example:**
  /// ```dart
  /// if (Measure.instance.shouldTrackHttpHeader('Content-Type')) {
  ///   // This header will be captured
  /// }
  /// ```
  ///
  /// See [MeasureConfig.httpHeadersBlocklist] for configuration options.
  @override
  bool shouldTrackHttpHeader(String key) {
    if (isInitialized) {
      return _measure.configProvider.shouldTrackHttpHeader(key);
    }
    return false;
  }

  /// Determines if HTTP request/response bodies should be tracked for the given URL and content type.
  ///
  /// This method considers the global [MeasureConfig.trackHttpBody] setting,
  /// URL filtering rules, and content type restrictions.
  ///
  /// **Parameters:**
  /// - [url]: The request URL
  /// - [contentType]: The content type of the request/response body (optional)
  ///
  /// **Returns:** `true` if the body should be captured, `false` otherwise
  ///
  /// **Example:**
  /// ```dart
  /// if (Measure.instance.shouldTrackHttpBody('https://api.example.com', 'application/json')) {
  ///   // Request/response bodies will be captured for this endpoint
  /// }
  /// ```
  ///
  /// **Note:** Capturing HTTP bodies can significantly increase data usage.
  @override
  bool shouldTrackHttpBody(String url, String? contentType) {
    if (isInitialized) {
      return _measure.configProvider.shouldTrackHttpBody(url, contentType);
    }
    return false;
  }

  /// Tracks a custom event with optional attributes and timestamp.
  ///
  /// Use this method to track important business events, user actions,
  /// or application milestones that are specific to your app.
  ///
  /// **Parameters:**
  /// - [name]: A descriptive name for the event (max 64 characters). Examples: 'user_signup', 'purchase_completed'
  /// - [attributes]: Optional key-value pairs providing additional context
  /// - [timestamp]: Optional timestamp in milliseconds since epoch (defaults to current time)
  ///
  /// **Attribute Types:**
  /// You can provide attributes in multiple ways:
  /// - Use [AttributeBuilder] for a fluent API with automatic type conversion
  /// - Use individual attribute classes ([StringAttr], [IntAttr], [DoubleAttr], [BooleanAttr])
  /// - Pass a pre-built attributes map
  ///
  /// **Example:**
  /// ```dart
  /// final attributes = AttributeBuilder()
  ///     .add('product_id', 'abc123')      // String
  ///     .add('price', 29.99)              // Double
  ///     .add('quantity', 2)               // Int
  ///     .add('is_premium', true)          // Boolean
  ///     .build();
  ///
  /// Measure.instance.trackEvent(
  ///   name: 'product_purchased',
  ///   attributes: attributes,
  /// );
  /// ```
  @override
  void trackEvent({
    required String name,
    Map<String, AttributeValue> attributes = const {},
    int? timestamp,
  }) {
    if (_isInitialized) {
      _measure.trackCustomEvent(name, timestamp, attributes);
    }
  }

  /// Tracks when a user views a screen or page in your application.
  ///
  /// Screen view events help you understand user navigation patterns
  /// and identify the most popular areas of your app.
  ///
  /// **Parameters:**
  /// - [name]: A unique identifier for the screen (e.g., 'HomeScreen', 'ProfilePage')
  ///
  /// **Example:**
  /// ```dart
  /// Measure.instance.trackScreenViewEvent(name: 'ProductDetailScreen');
  /// ```
  /// **Note:** Consider using [MsrNavigatorObserver] for automatic screen tracking
  /// instead of manual tracking for most use cases.
  @override
  void trackScreenViewEvent({
    required String name,
    Map<String, AttributeValue> attributes = const {},
    bool userTriggered = true,
  }) {
    if (_isInitialized) {
      _measure.trackScreenViewEvent(
        name: name,
        userTriggered: userTriggered,
        attributes: attributes,
      );
    }
  }

  /// Tracks HTTP network requests with detailed timing and response information.
  ///
  /// This method is typically called automatically by HTTP interceptors,
  /// but can be used for manual tracking of network requests.
  ///
  /// Use `measure_dio` package to automatically track network requests done
  /// using dio.
  ///
  /// **Parameters:**
  /// - [url]: The request URL
  /// - [method]: HTTP method (GET, POST, PUT, etc.)
  /// - [startTime]: Request start time in milliseconds since epoch
  /// - [endTime]: Request completion time in milliseconds since epoch
  /// - [statusCode]: HTTP response status code (e.g., 200, 404, 500)
  /// - [failureReason]: High-level failure category (e.g., 'network_error', 'timeout')
  /// - [failureDescription]: Detailed failure description
  /// - [requestHeaders]: HTTP request headers (subject to filtering)
  /// - [responseHeaders]: HTTP response headers (subject to filtering)
  /// - [requestBody]: Request payload (if enabled in config)
  /// - [responseBody]: Response payload (if enabled in config)
  /// - [client]: Optional identifier for the HTTP client used
  ///
  /// **Example:**
  /// ```dart
  /// final startTime = Measure.instance.getCurrentTime();
  ///
  /// // Make HTTP request...
  ///
  /// final endTime = Measure.instance.getCurrentTime();
  ///
  /// Measure.instance.trackHttpEvent(
  ///   url: 'https://api.example.com/users',
  ///   method: HttpMethod.get,
  ///   startTime: startTime,
  ///   endTime: endTime,
  ///   statusCode: 200,
  /// );
  /// ```
  @override
  void trackHttpEvent({
    required String url,
    required HttpMethod method,
    required int startTime,
    required int endTime,
    int? statusCode,
    String? failureReason,
    String? failureDescription,
    Map<String, String>? requestHeaders,
    Map<String, String>? responseHeaders,
    String? requestBody,
    String? responseBody,
    String? client,
  }) {
    if (_isInitialized) {
      _measure.trackHttpEvent(
        url: url,
        method: method,
        statusCode: statusCode,
        startTime: startTime,
        endTime: endTime,
        failureReason: failureReason,
        failureDescription: failureDescription,
        requestHeaders: requestHeaders,
        responseHeaders: responseHeaders,
        requestBody: requestBody,
        responseBody: responseBody,
        client: client,
      );
    }
  }

  /// Tracks a user-submitted bug report with description and attachments.
  ///
  /// This method is typically called by the built-in bug reporting UI
  /// when users submit feedback via the shake gesture or bug report widget.
  ///
  /// **Parameters:**
  /// - [description]: User-provided description of the issue
  /// - [attachments]: List of files/screenshots attached to the report
  /// - [attributes]: Additional context about the bug report
  ///
  /// **Example:**
  /// ```dart
  /// final screenshot = await Measure.instance.captureScreenshot();
  ///
  /// Measure.instance.trackBugReport(
  ///   description: 'App crashes when tapping the submit button',
  ///   attachments: screenshot != null ? [screenshot] : [],
  ///   attributes: {
  ///     'screen': StringAttr('CheckoutPage'),
  ///     'user_type': StringAttr('premium'),
  ///   },
  /// );
  /// ```
  ///
  /// **See also:**
  /// - [createBugReportWidget] for the built-in bug reporting UI
  /// - [captureScreenshot] for capturing screen attachments
  @override
  void trackBugReport({
    required String description,
    required List<MsrAttachment> attachments,
    required Map<String, AttributeValue> attributes,
  }) {
    if (_isInitialized) {
      _measure.trackBugReport(
        description,
        attachments,
        attributes,
      );
    }
  }

  /// Tracks a handled exception with its stack trace.
  ///
  /// Use this method to report exceptions that your app caught and handled
  /// gracefully. This helps identify potential issues that don't cause crashes
  /// but may indicate problems in your application logic.
  ///
  /// **Parameters:**
  /// - [error]: The exception object that was caught
  /// - [stack]: The stack trace at the point where the exception occurred
  ///
  /// **Example:**
  /// ```dart
  /// try {
  ///   await riskyNetworkOperation();
  /// } catch (error, stackTrace) {
  ///   // Handle the error gracefully
  ///   showErrorDialog('Network request failed');
  ///
  ///   // Track the handled error for monitoring
  ///   Measure.instance.trackHandledError(error, stackTrace);
  /// }
  /// ```
  ///
  /// **Note:** Unhandled exceptions are automatically tracked by the SDK.
  /// Only use this method for exceptions you explicitly catch.
  @override
  Future<void> trackHandledError(Object error, StackTrace stack) {
    if (_isInitialized) {
      final details = FlutterErrorDetails(exception: error, stack: stack);
      return _measure.trackError(details, handled: true);
    }
    return Future.value();
  }

  /// Deliberately triggers a native crash for testing crash reporting functionality.
  ///
  /// **⚠️ WARNING:** This method will immediately crash your application!
  /// Only use this in development builds for testing crash reporting.
  @override
  void triggerNativeCrash() {
    if (_isInitialized && kDebugMode) {
      _measure.triggerNativeCrash();
    }
  }

  /// Creates a [SpanBuilder] for building spans.
  ///
  /// Spans are used to measure the duration and context of operations
  /// in your application. They can be used to track performance of
  /// specific code blocks, network requests, or business operations.
  ///
  /// **Parameters:**
  /// - [name]: A descriptive name for the span operation
  ///
  /// **Returns:** A [SpanBuilder] instance, or `null` if SDK is not initialized
  ///
  /// **Example:**
  /// ```dart
  /// final span = Measure.instance.createSpanBuilder('user_authentication')
  ///     ?.setAttribute('user_id', 'user123')
  ///     ?.setAttribute('auth_method', 'oauth')
  ///     ?.startSpan();
  ///
  /// try {
  ///   await performAuthentication();
  ///   span?.setStatus(SpanStatus.ok);
  /// } catch (e) {
  ///   span?.setStatus(SpanStatus.error, description: e.toString());
  /// } finally {
  ///   span?.end();
  /// }
  /// ```
  ///
  /// **See also:**
  /// - [startSpan] for a simpler span creation API
  /// - [Span] for span management methods
  @override
  SpanBuilder? createSpanBuilder(String name) {
    if (isInitialized) {
      return _measure.createSpanBuilder(name);
    }
    return null;
  }

  /// Returns the HTTP header key used for distributed tracing.
  ///
  /// This header key is used to propagate tracing context across
  /// service boundaries in distributed systems.
  ///
  /// **Returns:** The standard trace parent header key (typically 'traceparent')
  ///
  /// **Example:**
  /// ```dart
  /// final headerKey = Measure.instance.getTraceParentHeaderKey();
  /// final headerValue = Measure.instance.getTraceParentHeaderValue(span);
  ///
  /// // Add to HTTP request
  /// final headers = {
  ///   headerKey: headerValue,
  ///   'Content-Type': 'application/json',
  /// };
  /// ```
  ///
  /// **See also:**
  /// - [getTraceParentHeaderValue] to get the header value for a span
  @override
  String getTraceParentHeaderKey() {
    return _measure.getTraceParentHeaderKey();
  }

  /// Creates and starts a new tracing span with the given name.
  ///
  /// **Parameters:**
  /// - [name]: A descriptive name for the span operation
  /// - [timestamp]: Optional start timestamp in milliseconds since epoch
  ///
  /// **Returns:** A [Span] instance, or an invalid span if not initialized
  ///
  /// **Example:**
  /// ```dart
  /// final span = Measure.instance.startSpan('database_query');
  ///
  /// try {
  ///   final result = await database.query('SELECT * FROM users');
  ///   span.setStatus(SpanStatus.ok);
  ///   return result;
  /// } catch (e) {
  ///   span.setStatus(SpanStatus.error, description: e.toString());
  ///   rethrow;
  /// } finally {
  ///   span.end();
  /// }
  /// ```
  ///
  /// **Note:** Always call [Span.end] when the operation completes to
  /// ensure accurate timing measurements.
  @override
  Span startSpan(String name, {int? timestamp}) {
    if (isInitialized) {
      return _measure.createSpanBuilder(name).startSpan(timestamp: timestamp);
    } else {
      return Span.invalid();
    }
  }

  /// Returns the HTTP header value for distributed tracing for the given span.
  ///
  /// This header value contains the tracing context that allows backend
  /// services to correlate requests with client-side spans.
  ///
  /// **Parameters:**
  /// - [span]: The span to generate the header value for
  ///
  /// **Returns:** The trace parent header value for the span
  ///
  /// **Example:**
  /// ```dart
  /// final span = Measure.instance.startSpan('api_call');
  /// final headerKey = Measure.instance.getTraceParentHeaderKey();
  /// final headerValue = Measure.instance.getTraceParentHeaderValue(span);
  ///
  /// // Use in HTTP client
  /// final response = await http.get(
  ///   Uri.parse('https://api.example.com/data'),
  ///   headers: {headerKey: headerValue},
  /// );
  ///
  /// span.end();
  /// ```
  ///
  /// **See also:**
  /// - [getTraceParentHeaderKey] to get the header key
  @override
  String getTraceParentHeaderValue(Span span) {
    return _measure.getTraceParentHeaderValue(span);
  }

  /// Returns the current timestamp in milliseconds since epoch.
  ///
  /// This method provides a consistent time source for the SDK,
  /// useful for manual event timestamping or performance measurements.
  ///
  /// **Returns:** Current timestamp in milliseconds since Unix epoch
  ///
  /// **Example:**
  /// ```dart
  /// final startTime = Measure.instance.getCurrentTime();
  ///
  /// await performOperation();
  ///
  /// final endTime = Measure.instance.getCurrentTime();
  /// final duration = endTime - startTime;
  ///
  /// Measure.instance.trackEvent(
  ///   name: 'operation_completed',
  ///   attributes: {'duration_ms': IntAttr(duration)},
  /// );
  /// ```
  @override
  int getCurrentTime() {
    if (isInitialized) {
      return _measure.getCurrentTime();
    } else {
      return DateTime.now().millisecondsSinceEpoch;
    }
  }

  /// Sets the current user identifier for the session.
  ///
  /// This identifier will be attached to all subsequent events,
  /// allowing you to filter and analyze data by user in your dashboard.
  ///
  /// **Parameters:**
  /// - [userId]: A unique identifier for the current user
  ///
  /// **Example:**
  /// ```dart
  /// // User logs in successfully
  /// final user = await authenticateUser(email, password);
  /// await Measure.instance.setUserId(user.id);
  /// ```
  ///
  /// **Note:** Avoid using personally identifiable information (PII)
  /// like email addresses as user IDs. Use anonymous identifiers instead.
  ///
  /// **See also:**
  /// - [clearUserId] to remove the user identifier
  /// - [getSessionId] to get the current session ID
  @override
  Future<void> setUserId(String userId) {
    if (isInitialized) {
      return _measure.setUserId(userId);
    }
    return Future.value(null);
  }

  /// Clears the current user identifier from the session.
  ///
  /// Call this method when a user logs out to stop associating
  /// subsequent events with the previous user.
  ///
  /// **Example:**
  /// ```dart
  /// // User logs out
  /// await performLogout();
  /// await Measure.instance.clearUserId();
  /// ```
  ///
  /// **See also:**
  /// - [setUserId] to set a user identifier
  /// - [getSessionId] to get the current session ID
  @override
  Future<void> clearUserId() async {
    if (isInitialized) {
      return _measure.clearUserId();
    }
    return Future.value(null);
  }

  /// Returns the current session identifier.
  ///
  /// Session IDs are automatically generated when the SDK starts and
  /// are used to group related events together. Sessions typically
  /// last until the app is closed or backgrounded for an extended period.
  ///
  /// **Returns:** The current session ID, or `null` if not initialized
  ///
  /// **Example:**
  /// ```dart
  /// final sessionId = await Measure.instance.getSessionId();
  /// print('Current session: $sessionId');
  /// ```
  @override
  Future<String?> getSessionId() async {
    if (isInitialized) {
      return _measure.getSessionId();
    }
    return Future.value(null);
  }

  /// Captures a screenshot of the current screen.
  ///
  /// This method returns a screenshot as an [MsrAttachment] that can be
  /// included in bug reports.
  ///
  /// **Returns:** An [MsrAttachment] containing the screenshot, or `null` if capture fails
  ///
  /// **Example:**
  /// ```dart
  /// final screenshot = await Measure.instance.captureScreenshot();
  ///
  /// if (screenshot != null) {
  ///   Measure.instance.trackBugReport(
  ///     description: 'UI rendering issue',
  ///     attachments: [screenshot],
  ///     attributes: {'screen': StringAttr('ProfilePage')},
  ///   );
  /// }
  /// ```
  ///
  /// **Note:** Screenshot capture may fail due to permissions or platform
  /// limitations. Always check for null before using the result.
  @override
  Future<MsrAttachment?> captureScreenshot() async {
    if (isInitialized) {
      return _measure.captureScreenshot();
    }
    return Future.value(null);
  }

  /// Creates a bug report widget that users can use to submit feedback.
  ///
  /// This widget provides a user-friendly interface for collecting bug reports
  /// with description, screenshots, and additional context.
  ///
  /// **Parameters:**
  /// - [key]: Optional widget key
  /// - [theme]: Custom styling for the bug report UI
  /// - [attributes]: Additional context to include with the report
  /// - [screenshot]: Optional screenshot to pre-populate
  ///
  /// **Returns:** A [Widget] containing the bug report UI, or empty widget if not initialized
  ///
  /// **Example:**
  /// ```dart
  /// void showBugReportDialog() {
  ///   showDialog(
  ///     context: context,
  ///     builder: (context) => Measure.instance.createBugReportWidget(
  ///       theme: BugReportTheme(
  ///         primaryColor: Colors.blue,
  ///         backgroundColor: Colors.white,
  ///       ),
  ///       attributes: {
  ///         'screen': StringAttr('HomeScreen'),
  ///         'user_type': StringAttr('premium'),
  ///       },
  ///     ),
  ///   );
  /// }
  /// ```
  ///
  /// **See also:**
  /// - [setShakeListener] for shake-to-report functionality
  /// - [MsrShakeDetectorMixin] for automatic shake detection
  @override
  Widget createBugReportWidget({
    Key? key,
    BugReportTheme theme = const BugReportTheme(),
    Map<String, AttributeValue>? attributes = const {},
    MsrAttachment? screenshot,
  }) {
    if (isInitialized) {
      return _measure.createBugReport(
        screenshot: screenshot,
        theme: theme,
        attributes: attributes,
      );
    } else {
      developer
          .log('Failed to open bug report, Measure SDK is not initialized');
      return SizedBox.shrink(key: key);
    }
  }

  /// Sets a callback function to handle shake gestures.
  ///
  /// When users shake their device, this callback will be invoked,
  /// typically to show a bug report dialog or feedback form.
  ///
  /// **Parameters:**
  /// - [onShake]: Callback function to execute when shake is detected, or `null` to disable
  ///
  /// **Example:**
  /// ```dart
  /// void setupShakeToReport() {
  ///   Measure.instance.setShakeListener(() {
  ///     showDialog(
  ///       context: context,
  ///       builder: (context) => Measure.instance.createBugReportWidget(),
  ///     );
  ///   });
  /// }
  ///
  /// // Disable shake detection
  /// Measure.instance.setShakeListener(null);
  /// ```
  ///
  /// **See also:**
  /// - [MsrShakeDetectorMixin] for automatic shake detection in widgets
  /// - [createBugReportWidget] for the bug report UI
  @override
  void setShakeListener(Function? onShake) {
    if (isInitialized) {
      _measure.setShakeListener(onShake);
    }
  }

  /// Tracks a user click/tap gesture.
  ///
  /// This method is typically called automatically by [MeasureWidget]
  /// when it detects tap gestures, but can be used for manual tracking.
  ///
  /// **Parameters:**
  /// - [clickData]: Data containing click position, target widget info, and timestamp
  ///
  /// **Example:**
  /// ```dart
  /// // Manual click tracking (not typically needed)
  /// final clickData = ClickData(
  ///   x: tapPosition.dx,
  ///   y: tapPosition.dy,
  ///   target: 'LoginButton',
  ///   timestamp: Measure.instance.getCurrentTime(),
  /// );
  ///
  /// Measure.instance.trackClick(clickData);
  /// ```
  ///
  /// **Note:** Consider using [MeasureWidget] wrapper for automatic
  /// gesture tracking instead of manual tracking.
  @override
  void trackClick(ClickData clickData) {
    if (isInitialized) {
      _measure.trackClick(clickData);
    }
  }

  /// Tracks a user long press gesture.
  ///
  /// This method is typically called automatically by [MeasureWidget]
  /// when it detects long press gestures, but can be used for manual tracking.
  ///
  /// **Parameters:**
  /// - [longClickData]: Data containing long press position, target widget info, and timestamp
  ///
  /// **Example:**
  /// ```dart
  /// // Manual long press tracking (not typically needed)
  /// final longClickData = LongClickData(
  ///   x: pressPosition.dx,
  ///   y: pressPosition.dy,
  ///   target: 'ImageWidget',
  ///   timestamp: Measure.instance.getCurrentTime(),
  /// );
  ///
  /// Measure.instance.trackLongClick(longClickData);
  /// ```
  ///
  /// **Note:** Consider using [MeasureWidget] wrapper for automatic
  /// gesture tracking instead of manual tracking.
  @override
  void trackLongClick(LongClickData longClickData) {
    if (isInitialized) {
      _measure.trackLongClick(longClickData);
    }
  }

  /// Tracks a user scroll gesture.
  ///
  /// This method is typically called automatically by [MeasureWidget]
  /// when it detects scroll gestures, but can be used for manual tracking.
  ///
  /// **Parameters:**
  /// - [scrollData]: Data containing scroll direction, distance, and target widget info
  ///
  /// **Example:**
  /// ```dart
  /// // Manual scroll tracking (not typically needed)
  /// final scrollData = ScrollData(
  ///   direction: ScrollDirection.down,
  ///   deltaX: 0.0,
  ///   deltaY: -150.0,
  ///   target: 'ProductList',
  ///   timestamp: Measure.instance.getCurrentTime(),
  /// );
  ///
  /// Measure.instance.trackScroll(scrollData);
  /// ```
  ///
  /// **Note:** Consider using [MeasureWidget] wrapper for automatic
  /// gesture tracking instead of manual tracking.
  @override
  void trackScroll(ScrollData scrollData) {
    if (isInitialized) {
      _measure.trackScroll(scrollData);
    }
  }

  Future<void> _initializeMeasureSDK(
    MeasureConfig config,
    ClientInfo clientInfo,
  ) async {
    final methodChannel = _methodChannel ?? MsrMethodChannel();
    await _initializeNativeSDK(config, clientInfo, methodChannel);
    await _initializeInternal(config, methodChannel);
  }

  Future<void> _initializeNativeSDK(
    MeasureConfig config,
    ClientInfo clientInfo,
    MsrMethodChannel methodChannel,
  ) async {
    if (config.autoInitializeNativeSDK) {
      var jsonConfig = config.toJson();
      var jsonClientInfo = clientInfo.toJson();
      _logInputConfig(config.enableLogging, jsonConfig, jsonClientInfo);
      return methodChannel.initializeNativeSDK(jsonConfig, jsonClientInfo);
    }
    return Future.value();
  }

  Future<void> _initializeInternal(
    MeasureConfig config,
    MsrMethodChannel methodChannel,
  ) async {
    final initializer = MeasureInitializer(config);
    _measure = MeasureInternal(
      initializer: initializer,
      methodChannel: methodChannel,
    );
    await _measure.init();
  }

  Future<void> _setupErrorHandling() async {
    _initFlutterOnError();
    _initPlatformDispatcherOnError();
  }

  Future<void> _initFlutterOnError() async {
    final originalHandler = FlutterError.onError;
    FlutterError.onError = (FlutterErrorDetails details) async {
      await _measure.trackError(details, handled: false);
      if (originalHandler != null) {
        originalHandler(details);
      }
    };
  }

  Future<void> _initPlatformDispatcherOnError() async {
    PlatformDispatcher.instance.onError = (exception, stackTrace) {
      final details = FlutterErrorDetails(
        exception: exception,
        stack: stackTrace,
      );
      _measure.trackError(details, handled: false);
      return false;
    };
  }

  bool _validateClientInfo(ClientInfo clientInfo) {
    if (clientInfo.apiKey.isEmpty) {
      developer.log("Failed to initialize Measure, apiKey is empty");
      return false;
    }

    if (!clientInfo.apiKey.startsWith("msrsh")) {
      developer.log("Failed to initialize Measure, apiKey is invalid");
      return false;
    }

    if (clientInfo.apiUrl.toString().isEmpty) {
      developer.log("Failed to initialize Measure, apiUrl is empty");
      return false;
    }
    return true;
  }

  void _logInitializationSuccess() {
    _measure.logger.log(
      LogLevel.debug,
      "Successfully initialized Measure Flutter SDK",
    );
  }

  void _logInitializationFailure(
      bool enableLogging,
      Object error,
      StackTrace stackTrace,
      ) {
    if (enableLogging) {
      developer.log(
        'Failed to initialize measure-flutter',
        name: 'Measure',
        error: error,
        stackTrace: stackTrace,
        level: 900,
      );
    }
  }

  void _logInputConfig(bool enableLogging, Map<String, dynamic> jsonConfig,
      Map<String, String> jsonClientInfo) {
    if (enableLogging) {
      developer.log(
        'Initializing measure-flutter with config: $jsonConfig',
        name: 'Measure',
        level: 100,
      );
      developer.log(
        'Initializing measure-flutter with client info: $jsonClientInfo',
        name: 'Measure',
        level: 100,
      );
    }
  }
}
