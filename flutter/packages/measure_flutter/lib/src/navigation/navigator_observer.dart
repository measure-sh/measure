import 'package:flutter/material.dart';

import '../../measure_flutter.dart';

/// A [NavigatorObserver] that automatically tracks screen navigation events.
/// 
/// [MsrNavigatorObserver] monitors route changes in your Flutter app and
/// automatically reports screen view events to the Measure SDK. This provides
/// insight into user navigation patterns and screen popularity.
/// 
/// **Usage:**
/// ```dart
/// class MyApp extends StatelessWidget {
///   @override
///   Widget build(BuildContext context) {
///     return MaterialApp(
///       navigatorObservers: [MsrNavigatorObserver()],
///       routes: {
///         '/': (context) => HomeScreen(),
///         '/profile': (context) => ProfileScreen(),
///         '/settings': (context) => SettingsScreen(),
///       },
///     );
///   }
/// }
/// ```
/// 
/// **Named Routes:**
/// For automatic screen tracking to work properly, use named routes:
/// ```dart
/// // Good - will be tracked as 'ProfileScreen'
/// Navigator.pushNamed(context, '/profile');
/// 
/// // Or provide explicit names
/// Navigator.push(
///   context,
///   MaterialPageRoute(
///     builder: (context) => ProfileScreen(),
///     settings: RouteSettings(name: 'ProfileScreen'),
///   ),
/// );
/// ```
class MsrNavigatorObserver extends NavigatorObserver {
  final MeasureApi _measure;

  MsrNavigatorObserver() : _measure = Measure.instance;

  @visibleForTesting
  MsrNavigatorObserver.withMeasure(this._measure);

  @override
  void didPush(Route route, Route? previousRoute) {
    _trackScreenView(route.settings.name);
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    _trackScreenView(previousRoute?.settings.name);
  }

  @override
  void didReplace({Route? newRoute, Route? oldRoute}) {
    _trackScreenView(newRoute?.settings.name);
  }

  void _trackScreenView(String? name) {
    if (name != null && name.isNotEmpty) {
      _measure.trackScreenViewEvent(name: name, userTriggered: false);
    }
  }
}
