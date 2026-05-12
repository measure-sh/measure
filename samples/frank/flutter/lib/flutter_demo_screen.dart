import 'dart:io' show Platform;
import 'dart:isolate';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:measure_dio/measure_dio.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:stack_trace/stack_trace.dart';

import 'bottom_nav_demo.dart';
import 'layout_snapshot_page.dart';

class _CustomException implements Exception {
  final String message;
  _CustomException(this.message);
  @override
  String toString() => message;
}

enum _DemoCategory {
  crashes('Crashes'),
  bugReports('Bug Reports'),
  navigation('Navigation'),
  http('HTTP'),
  misc('Misc');

  final String label;
  const _DemoCategory(this.label);
}

class _DemoItem {
  final String title;
  final String description;
  final _DemoCategory category;
  final VoidCallback action;

  const _DemoItem({
    required this.title,
    required this.description,
    required this.category,
    required this.action,
  });
}

class FlutterDemoScreen extends StatefulWidget {
  const FlutterDemoScreen({super.key});

  @override
  State<FlutterDemoScreen> createState() => _FlutterDemoScreenState();
}

class _FlutterDemoScreenState extends State<FlutterDemoScreen>
    with MsrShakeDetectorMixin {
  bool _shakeEnabled = false;

  @override
  void dispose() {
    disableShakeDetection();
    super.dispose();
  }

  @override
  void onShakeDetected() {
    _launchBugReport();
  }

  void _toggleShake(bool enabled) {
    setState(() => _shakeEnabled = enabled);
    if (enabled) {
      enableShakeDetection();
    } else {
      disableShakeDetection();
    }
  }

  // -- Crashes --

  void _throwError() {
    throw ArgumentError('This is an error');
  }

  void _throwException() {
    throw const FormatException('This is an exception');
  }

  void _throwAsyncException() {
    Chain.capture(() async {
      await Future.delayed(const Duration(seconds: 2));
      throw const FormatException('Async exception via Chain.capture');
    });
  }

  void _throwMicrotaskError() {
    Future.microtask(() {
      throw const FormatException('Exception from Future.microtask');
    });
  }

  void _throwIsolateError() {
    Isolate.run(() {
      throw const FormatException('Exception from Isolate.run');
    });
  }

  void _throwString() {
    // ignore: only_throw_errors
    throw 'are you serious?';
  }

  void _throwNativeCrash() {
    Measure.instance.triggerNativeCrash();
  }

  void _throwOOM() {
    List<int> list = [];
    while (true) {
      list.addAll(List.filled(1024 * 1024, 42));
    }
  }

  void _throwChainedException() {
    throw _CustomException('Chained: root cause').toString();
  }

  void _noMethodChannel() async {
    await const MethodChannel('non_existent_channel')
        .invokeMethod('non_existent_method');
  }

  // -- Bug Reports --

  void _trackBugReport() async {
    final screenshot = await Measure.instance.captureScreenshot();
    Measure.instance.trackBugReport(
      description: 'Unable to place an order',
      attachments: [if (screenshot != null) screenshot],
      attributes: AttributeBuilder().add('order_id', 'order-12345').build(),
    );
  }

  void _launchBugReport() async {
    final navigator = Navigator.of(context);
    final screenshot = await Measure.instance.captureScreenshot();
    if (mounted) {
      navigator.push(
        MaterialPageRoute<Widget>(
          builder: (context) => Measure.instance.createBugReportWidget(
            screenshot: screenshot,
            theme: BugReportTheme(
              colors: BugReportColors(
                primaryColor: Theme.of(context).colorScheme.primary,
              ),
            ),
          ),
          settings: const RouteSettings(name: '/msr_bug_report'),
        ),
      );
    }
  }

  // -- Navigation --

  void _navigateToSimpleScreen() {
    Navigator.push(
      context,
      MaterialPageRoute<Widget>(
        builder: (context) => const _SimpleNavigationScreen(),
        settings: const RouteSettings(name: '/simple_navigation'),
      ),
    );
  }

  void _navigateToBottomNav() {
    Navigator.push(
      context,
      MaterialPageRoute<Widget>(
        builder: (context) => const BottomNavDemo(),
        settings: const RouteSettings(name: '/bottom_nav_demo'),
      ),
    );
  }

  void _navigateToTextOverflow() {
    Navigator.push(
      context,
      MaterialPageRoute<Widget>(
        builder: (context) => const _TextOverflowScreen(),
        settings: const RouteSettings(name: '/text_overflow'),
      ),
    );
  }

  void _navigateToInvalidRoute() {
    Navigator.of(context).pushNamed('/non_existent_route');
  }

  // -- Misc --

  void _trackCustomEvent() {
    final attrs = AttributeBuilder()
      ..add('is_premium', true)
      ..add('integer', 1)
      ..add('string', 'string');
    Measure.instance.trackEvent(name: 'event', attributes: attrs.build());
  }

  void _dioGet() async {
    final dio = Dio();
    dio.interceptors.add(MsrInterceptor());
    try {
      await dio.get('https://fakestoreapi.com/products/1');
    } catch (_) {}
  }

  void _dioPost() async {
    final dio = Dio();
    dio.interceptors.add(MsrInterceptor());
    try {
      await dio.post(
        'https://fakestoreapi.com/users',
        data: {
          'id': 0,
          'username': 'string',
          'email': 'string',
          'password': 'string',
        },
        options: Options(headers: {'X-Custom-Header': 'custom_value'}),
      );
    } catch (_) {}
  }

  void _dioFailure() async {
    final dio = Dio();
    dio.interceptors.add(MsrInterceptor());
    try {
      await dio.get('https://fakestoreapi.com/login');
    } catch (_) {}
  }

  void _createSpan() async {
    final attributes = AttributeBuilder().add('is_premium', false).build();
    final span = Measure.instance
        .startSpan('load-data')
        .setCheckpoint('on-start')
        .setAttributes(attributes)
        .setStatus(SpanStatus.error);
    await Future.delayed(const Duration(seconds: 2));
    span.setCheckpoint('on-error');
    span.end();
  }

  void _createNestedSpan() async {
    final profileSpan = Measure.instance
        .startSpan('load-user-profile')
        .setCheckpoint('profile-load-started')
        .setAttributes(
          AttributeBuilder()
              .add('user_id', 'user_12345')
              .add('cache_enabled', true)
              .build(),
        );

    final cacheSpan = Measure.instance
        .startSpan('check-profile-cache')
        .setParent(profileSpan)
        .setCheckpoint('cache-check-started');
    await Future.delayed(const Duration(milliseconds: 100));
    cacheSpan.setCheckpoint('cache-miss').setStatus(SpanStatus.ok);
    cacheSpan.end();

    final apiSpan = Measure.instance
        .startSpan('fetch-profile-api')
        .setParent(profileSpan)
        .setCheckpoint('api-request-sent')
        .setAttributes(
          AttributeBuilder()
              .add('endpoint', '/api/v1/user/profile')
              .add('timeout_ms', 5000)
              .build(),
        );
    await Future.delayed(const Duration(milliseconds: 800));
    apiSpan.setCheckpoint('api-response-received').setStatus(SpanStatus.ok);
    apiSpan.end();

    profileSpan.setCheckpoint('profile-loaded').setStatus(SpanStatus.ok);
    profileSpan.end();
  }

  void _launchLayoutSnapshot() {
    Navigator.push(
      context,
      MaterialPageRoute<Widget>(
        builder: (context) => const LayoutSnapshotPage(),
        settings: const RouteSettings(name: '/layout_snapshot'),
      ),
    );
  }

  void _setUserId() {
    Measure.instance.setUserId('user-131351');
  }

  void _clearUserId() {
    Measure.instance.clearUserId();
  }

  List<_DemoItem> _buildDemos() => [
        // Crashes
        _DemoItem(
          title: 'Throw Error',
          description: 'Throws an ArgumentError',
          category: _DemoCategory.crashes,
          action: _throwError,
        ),
        _DemoItem(
          title: 'Throw Exception',
          description: 'Throws a FormatException',
          category: _DemoCategory.crashes,
          action: _throwException,
        ),
        _DemoItem(
          title: 'Async Exception',
          description: 'Exception via Chain.capture after delay',
          category: _DemoCategory.crashes,
          action: _throwAsyncException,
        ),
        _DemoItem(
          title: 'Microtask Error',
          description: 'Exception from Future.microtask',
          category: _DemoCategory.crashes,
          action: _throwMicrotaskError,
        ),
        _DemoItem(
          title: 'Isolate Error',
          description: 'Exception from Isolate.run',
          category: _DemoCategory.crashes,
          action: _throwIsolateError,
        ),
        _DemoItem(
          title: 'Throw String',
          description: 'Throws a string instead of an exception',
          category: _DemoCategory.crashes,
          action: _throwString,
        ),
        _DemoItem(
          title: 'Native Crash',
          description: 'Triggers a native crash via Measure SDK',
          category: _DemoCategory.crashes,
          action: _throwNativeCrash,
        ),
        _DemoItem(
          title: 'Out of Memory',
          description: 'Allocates memory until OOM',
          category: _DemoCategory.crashes,
          action: _throwOOM,
        ),
        _DemoItem(
          title: 'No Method Channel',
          description: 'Invokes a non-existent method channel',
          category: _DemoCategory.crashes,
          action: _noMethodChannel,
        ),

        // Bug Reports
        _DemoItem(
          title: 'Track Bug Report',
          description: 'Captures screenshot and submits report',
          category: _DemoCategory.bugReports,
          action: _trackBugReport,
        ),
        _DemoItem(
          title: 'Launch Bug Report',
          description: 'Opens interactive bug report form',
          category: _DemoCategory.bugReports,
          action: _launchBugReport,
        ),

        // Navigation
        _DemoItem(
          title: 'Simple Navigation',
          description: 'Push a basic screen',
          category: _DemoCategory.navigation,
          action: _navigateToSimpleScreen,
        ),
        _DemoItem(
          title: 'Bottom Nav Demo',
          description: 'Three-tab bottom navigation',
          category: _DemoCategory.navigation,
          action: _navigateToBottomNav,
        ),
        _DemoItem(
          title: 'Text Overflow',
          description: 'Layout with constrained overflow',
          category: _DemoCategory.navigation,
          action: _navigateToTextOverflow,
        ),
        _DemoItem(
          title: 'Invalid Route',
          description: 'Pushes a non-existent named route',
          category: _DemoCategory.navigation,
          action: _navigateToInvalidRoute,
        ),

        // Misc
        _DemoItem(
          title: 'Custom Event',
          description: 'Tracks an event with attributes',
          category: _DemoCategory.misc,
          action: _trackCustomEvent,
        ),
        // HTTP
        _DemoItem(
          title: 'Dio GET',
          description: 'HTTP GET with Measure tracing',
          category: _DemoCategory.http,
          action: _dioGet,
        ),
        _DemoItem(
          title: 'Dio POST',
          description: 'HTTP POST with custom headers',
          category: _DemoCategory.http,
          action: _dioPost,
        ),
        _DemoItem(
          title: 'Dio Failure',
          description: 'Intentional HTTP failure',
          category: _DemoCategory.http,
          action: _dioFailure,
        ),
        _DemoItem(
          title: 'Create Span',
          description: 'Span with checkpoints and attributes',
          category: _DemoCategory.misc,
          action: _createSpan,
        ),
        _DemoItem(
          title: 'Nested Span',
          description: 'Parent-child span hierarchy',
          category: _DemoCategory.misc,
          action: _createNestedSpan,
        ),
        _DemoItem(
          title: 'Layout Snapshot',
          description: 'Grid with 5000 items for performance',
          category: _DemoCategory.misc,
          action: _launchLayoutSnapshot,
        ),
        _DemoItem(
          title: 'Set User ID',
          description: 'Sets a dummy user ID on the SDK',
          category: _DemoCategory.misc,
          action: _setUserId,
        ),
        _DemoItem(
          title: 'Clear User ID',
          description: 'Clears the current user ID',
          category: _DemoCategory.misc,
          action: _clearUserId,
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final demos = _buildDemos();
    final grouped = <_DemoCategory, List<_DemoItem>>{};
    for (final demo in demos) {
      grouped.putIfAbsent(demo.category, () => []).add(demo);
    }

    final children = <Widget>[];
    for (final category in _DemoCategory.values) {
      final items = grouped[category];
      if (items == null) continue;

      children.add(_SectionHeader(title: category.label));
      for (final demo in items) {
        children.add(_DemoCard(demo: demo));
      }
      if (category == _DemoCategory.bugReports) {
        children.add(_ShakeToggleCard(
          enabled: _shakeEnabled,
          onToggle: _toggleShake,
        ));
      }
    }
    children.add(const SizedBox(height: 8));

    return Scaffold(
      appBar: Platform.isIOS
          ? null
          : AppBar(
              title: const Text('Flutter Demos'),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => SystemNavigator.pop(),
              ),
            ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: children,
        ),
      ),
    );
  }
}

// -- Reusable widgets --

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 4),
      child: Text(
        title,
        style: theme.textTheme.titleSmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _DemoCard extends StatelessWidget {
  final _DemoItem demo;
  const _DemoCard({required this.demo});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Material(
        // ignore: deprecated_member_use
        color: theme.colorScheme.surface.withOpacity(0.6),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        child: InkWell(
          onTap: demo.action,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  demo.title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                ExcludeSemantics(
                  child: Text(
                    demo.description,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ShakeToggleCard extends StatelessWidget {
  final bool enabled;
  final ValueChanged<bool> onToggle;
  const _ShakeToggleCard({required this.enabled, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Material(
        // ignore: deprecated_member_use
        color: theme.colorScheme.surface.withOpacity(0.6),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Shake to Report',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: theme.colorScheme.onSurface,
                      ),
                    ),
                    ExcludeSemantics(
                      child: Text(
                        'Shake device to open bug report',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Switch(
                value: enabled,
                onChanged: onToggle,
                activeTrackColor: theme.colorScheme.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// -- Sub-screens (inline, minimal) --

class _SimpleNavigationScreen extends StatelessWidget {
  const _SimpleNavigationScreen();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Navigation')),
      body: Center(
        child: Text(
          'Navigation Screen',
          style: theme.textTheme.headlineMedium?.copyWith(
            color: theme.colorScheme.onSurface,
          ),
        ),
      ),
    );
  }
}

class _TextOverflowScreen extends StatelessWidget {
  const _TextOverflowScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Text Overflow')),
      body: Row(
        children: [
          Container(width: 200),
          Container(width: 200),
        ],
      ),
    );
  }
}
