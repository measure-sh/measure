import 'dart:async';

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
  /// Grace period added to a route's transition duration before the wait for
  /// the transition to end is abandoned.
  static const _transitionTimeoutMargin = Duration(milliseconds: 100);

  final MeasureApi _measure;

  MsrNavigatorObserver() : _measure = Measure.instance;

  @visibleForTesting
  MsrNavigatorObserver.withMeasure(this._measure);

  @override
  void didPush(Route route, Route? previousRoute) {
    _trackScreenView(route.settings.name, route, AnimationStatus.completed);
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    _trackScreenView(
      previousRoute?.settings.name,
      route,
      AnimationStatus.dismissed,
    );
  }

  @override
  void didReplace({Route? newRoute, Route? oldRoute}) {
    _trackScreenView(
      newRoute?.settings.name,
      newRoute,
      AnimationStatus.completed,
    );
  }

  /// Tracks the screen view once [transitioningRoute] reaches [settledStatus].
  ///
  /// The layout snapshot attached to the event is captured when the event is
  /// tracked, so waiting for the transition keeps it from showing the first
  /// frame of an animation instead of the screen the user lands on. The
  /// timestamp is taken when the navigation happens, so the event still sits
  /// where the user navigated on the session timeline.
  void _trackScreenView(
    String? name,
    Route<dynamic>? transitioningRoute,
    AnimationStatus settledStatus,
  ) {
    if (name == null || name.isEmpty) {
      return;
    }
    final timestamp = _measure.getCurrentTime();
    final route =
        transitioningRoute is TransitionRoute ? transitioningRoute : null;
    if (route == null || route.animation == null) {
      _track(name, timestamp);
      return;
    }
    _whenTransitionEnds(route, settledStatus)
        .then((_) => _track(name, timestamp));
  }

  /// Completes once [route] has finished animating.
  ///
  /// A pushed route reports a settled status for an instant before its
  /// transition starts, so the wait begins on the next frame, by which point
  /// the animation reflects the transition that is actually running.
  Future<void> _whenTransitionEnds(
    TransitionRoute<dynamic> route,
    AnimationStatus settledStatus,
  ) async {
    await WidgetsBinding.instance.endOfFrame;
    final animation = route.animation;
    // A route removed during its transition is left holding an animation that
    // never moves again, and [Route.navigator] is cleared when it goes.
    if (animation == null ||
        route.navigator == null ||
        animation.status == settledStatus) {
      return;
    }
    final completer = Completer<void>();
    void onStatusChanged(AnimationStatus status) {
      if (status == AnimationStatus.completed ||
          status == AnimationStatus.dismissed) {
        animation.removeStatusListener(onStatusChanged);
        completer.complete();
      }
    }

    animation.addStatusListener(onStatusChanged);
    final duration = settledStatus == AnimationStatus.dismissed
        ? route.reverseTransitionDuration
        : route.transitionDuration;
    // A route removed after this point never reaches a settled status, and the
    // screen view must not be lost with it.
    await completer.future.timeout(
      duration + _transitionTimeoutMargin,
      onTimeout: () => animation.removeStatusListener(onStatusChanged),
    );
  }

  void _track(String name, int timestamp) {
    _measure.trackScreenViewEvent(
      name: name,
      userTriggered: false,
      timestamp: timestamp,
    );
  }
}
