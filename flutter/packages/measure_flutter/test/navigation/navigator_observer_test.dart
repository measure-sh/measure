import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';

import '../utils/fake_measure.dart';

void main() {
  late FakeMeasure fakeMeasure;
  late MsrNavigatorObserver observer;

  setUp(() {
    fakeMeasure = FakeMeasure();
    observer = MsrNavigatorObserver.withMeasure(fakeMeasure);
  });

  List<String> trackedNames() =>
      fakeMeasure.trackedScreenViews.map((call) => call.name).toList();

  // Routes built outside a Navigator are never installed, so they have no
  // transition to wait on and are tracked as soon as the callback fires.
  Route<void> route(String? name) => MaterialPageRoute<void>(
        settings: RouteSettings(name: name),
        builder: (_) => const SizedBox(),
      );

  group('the screen a navigation lands on', () {
    test('is the pushed route, the route revealed by a pop, or the replacement',
        () {
      observer.didPush(route('/pushed'), route('/under'));
      observer.didPop(route('/popped'), route('/revealed'));
      observer.didReplace(newRoute: route('/new'), oldRoute: route('/old'));

      expect(trackedNames(), equals(['/pushed', '/revealed', '/new']));
    });

    test('is not tracked when that route has no usable name', () {
      for (final name in <String?>[null, '']) {
        observer.didPush(route(name), route('/under'));
        observer.didPop(route('/popped'), route(name));
        observer.didReplace(newRoute: route(name), oldRoute: route('/old'));
      }

      expect(trackedNames(), isEmpty);
    });

    test('is not tracked when there is no route to land on', () {
      observer.didPop(route('/popped'), null);
      observer.didReplace(newRoute: null, oldRoute: route('/old'));

      expect(trackedNames(), isEmpty);
    });
  });

  group('route transitions', () {
    Future<void> pumpApp(WidgetTester tester) {
      return tester.pumpWidget(MaterialApp(
        navigatorObservers: [observer],
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  settings: const RouteSettings(name: '/details'),
                  builder: (_) => const Scaffold(body: Text('Details')),
                ),
              ),
              child: const Text('Push'),
            ),
          ),
        ),
      ));
    }

    testWidgets('the initial route is tracked without waiting', (tester) async {
      await pumpApp(tester);

      expect(trackedNames(), equals(['/']));
    });

    testWidgets('a push is tracked once its transition has ended, stamped at '
        'the navigation', (tester) async {
      await pumpApp(tester);
      fakeMeasure.clear();
      fakeMeasure.currentTime = 1000;

      await tester.tap(find.text('Push'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(trackedNames(), isEmpty);

      fakeMeasure.currentTime = 9999;
      await tester.pumpAndSettle();

      expect(trackedNames(), equals(['/details']));
      expect(fakeMeasure.trackedScreenViews.single.timestamp, equals(1000));
    });

    testWidgets('a pop is tracked once its transition has ended',
        (tester) async {
      await pumpApp(tester);
      await tester.tap(find.text('Push'));
      await tester.pumpAndSettle();
      fakeMeasure.clear();

      tester.state<NavigatorState>(find.byType(Navigator)).pop();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(trackedNames(), isEmpty);

      await tester.pumpAndSettle();

      expect(trackedNames(), equals(['/']));
    });

    testWidgets('a route removed mid transition is still tracked',
        (tester) async {
      await pumpApp(tester);
      fakeMeasure.clear();

      await tester.tap(find.text('Push'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      tester.state<NavigatorState>(find.byType(Navigator)).removeRoute(
            ModalRoute.of(tester.element(find.text('Details')))!,
          );
      await tester.pumpAndSettle();

      expect(trackedNames(), equals(['/details']));
    });
  });
}
