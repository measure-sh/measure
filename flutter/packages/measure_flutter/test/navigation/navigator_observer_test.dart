import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure.dart';

import '../utils/fake_measure.dart';

void main() {
  group('MsrNavigatorObserver', () {
    late FakeMeasure fakeMeasure;
    late MsrNavigatorObserver observer;

    setUp(() {
      fakeMeasure = FakeMeasure();
      observer = MsrNavigatorObserver.withMeasure(fakeMeasure);
    });

    tearDown(() {
      fakeMeasure.clear();
    });

    group('didPush', () {
      test('should track screen view with route name', () {
        // Arrange
        const routeName = '/home';
        final route = MaterialPageRoute(
          settings: const RouteSettings(name: routeName),
          builder: (context) => Container(),
        );
        final previousRoute = MaterialPageRoute(
          settings: const RouteSettings(name: '/previous'),
          builder: (context) => Container(),
        );

        // Act
        observer.didPush(route, previousRoute);

        // Assert
        expect(fakeMeasure.trackedScreenViews.length, 1);
        expect(fakeMeasure.trackedScreenViews.last.name, routeName);
        expect(fakeMeasure.trackedScreenViews.last.userTriggered, false);
      });

      test('should not track screen view when route name is null', () {
        // Arrange
        final route = MaterialPageRoute(
          settings: const RouteSettings(name: null),
          builder: (context) => Container(),
        );

        // Act
        observer.didPush(route, null);

        // Assert
        expect(fakeMeasure.trackedScreenViews.length, 0);
      });
    });

    group('didPop', () {
      test('should track screen view with previous route name', () {
        // Arrange
        const previousRouteName = '/previous';
        final route = MaterialPageRoute(
          settings: const RouteSettings(name: '/current'),
          builder: (context) => Container(),
        );
        final previousRoute = MaterialPageRoute(
          settings: const RouteSettings(name: previousRouteName),
          builder: (context) => Container(),
        );

        // Act
        observer.didPop(route, previousRoute);

        // Assert
        expect(fakeMeasure.trackedScreenViews.length, 1);
        expect(fakeMeasure.trackedScreenViews.last.name, previousRouteName);
        expect(fakeMeasure.trackedScreenViews.last.userTriggered, false);
      });

      test('should not track screen view when previous route is null', () {
        // Arrange
        final route = MaterialPageRoute(
          settings: const RouteSettings(name: '/current'),
          builder: (context) => Container(),
        );

        // Act
        observer.didPop(route, null);

        // Assert
        expect(fakeMeasure.trackedScreenViews.length, 0);
      });

      test('should not track screen view when previous route is empty', () {
        // Arrange
        final route = MaterialPageRoute(
          settings: const RouteSettings(name: ''),
          builder: (context) => Container(),
        );

        // Act
        observer.didPop(route, null);

        // Assert
        expect(fakeMeasure.trackedScreenViews.length, 0);
      });

      test('should not track screen view when previous route name is null', () {
        // Arrange
        final route = MaterialPageRoute(
          settings: const RouteSettings(name: '/current'),
          builder: (context) => Container(),
        );
        final previousRoute = MaterialPageRoute(
          settings: const RouteSettings(name: null),
          builder: (context) => Container(),
        );

        // Act
        observer.didPop(route, previousRoute);

        // Assert
        expect(fakeMeasure.trackedScreenViews.length, 0);
      });
    });

    group('didReplace', () {
      test('should track screen view with new route name', () {
        // Arrange
        const newRouteName = '/new';
        final newRoute = MaterialPageRoute(
          settings: const RouteSettings(name: newRouteName),
          builder: (context) => Container(),
        );
        final oldRoute = MaterialPageRoute(
          settings: const RouteSettings(name: '/old'),
          builder: (context) => Container(),
        );

        // Act
        observer.didReplace(newRoute: newRoute, oldRoute: oldRoute);

        // Assert
        expect(fakeMeasure.trackedScreenViews.length, 1);
        expect(fakeMeasure.trackedScreenViews.last.name, newRouteName);
        expect(fakeMeasure.trackedScreenViews.last.userTriggered, false);
      });

      test('should not track screen view when new route is null', () {
        // Arrange
        final oldRoute = MaterialPageRoute(
          settings: const RouteSettings(name: '/old'),
          builder: (context) => Container(),
        );

        // Act
        observer.didReplace(newRoute: null, oldRoute: oldRoute);

        // Assert
        expect(fakeMeasure.trackedScreenViews.length, 0);
      });

      test('should not track screen view when new route name is null', () {
        // Arrange
        final newRoute = MaterialPageRoute(
          settings: const RouteSettings(name: null),
          builder: (context) => Container(),
        );
        final oldRoute = MaterialPageRoute(
          settings: const RouteSettings(name: '/old'),
          builder: (context) => Container(),
        );

        // Act
        observer.didReplace(newRoute: newRoute, oldRoute: oldRoute);

        // Assert
        expect(fakeMeasure.trackedScreenViews.length, 0);
      });
    });
  });
}
