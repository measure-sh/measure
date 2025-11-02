import 'package:build_test/build_test.dart';
import 'package:measure_build/src/builders/widget_analyzer_builder.dart';
import 'package:test/test.dart';

// Mock Flutter SDK classes for testing
const mockFlutterWidgets = '''
library flutter.widgets;

abstract class Widget {
  const Widget();
}

abstract class StatelessWidget extends Widget {
  const StatelessWidget();
  Widget build(Object context);
}

abstract class StatefulWidget extends Widget {
  const StatefulWidget();
}

abstract class State<T extends StatefulWidget> {
  Widget build(Object context);
}

class Container extends StatelessWidget {
  const Container();
  @override
  Widget build(Object context) => this;
}
''';

void main() {
  group('WidgetAnalyzerBuilder', () {
    test('detects StatelessWidget subclass', () async {
      final builder = WidgetAnalyzerBuilder(
        buildExtensions: {r'$lib$': ['msr_widgets.g.dart']},
      );

      await testBuilder(
        builder,
        {
          'flutter|lib/widgets.dart': mockFlutterWidgets,
          'test_pkg|lib/my_widget.dart': '''
            import 'package:flutter/widgets.dart';

            class MyStatelessWidget extends StatelessWidget {
              const MyStatelessWidget();

              @override
              Widget build(Object context) => Container();
            }
          ''',
        },
        outputs: {
          'flutter|lib/msr_widgets.g.dart': anything, // Flutter mock package output
          'test_pkg|lib/msr_widgets.g.dart': decodedMatches(allOf([
            contains('// GENERATED CODE - DO NOT MODIFY BY HAND'),
            contains('MyStatelessWidget'),
            contains("MyStatelessWidget: 'MyStatelessWidget'"),
          ])),
        },

      );
    });

    test('detects StatefulWidget subclass', () async {
      final builder = WidgetAnalyzerBuilder(
        buildExtensions: {r'$lib$': ['msr_widgets.g.dart']},
      );

      await testBuilder(
        builder,
        {
          'flutter|lib/widgets.dart': mockFlutterWidgets,
          'test_pkg2|lib/my_widget.dart': '''
            import 'package:flutter/widgets.dart';

            class MyStatefulWidget extends StatefulWidget {
              const MyStatefulWidget();
            }

            class _MyStatefulWidgetState extends State<MyStatefulWidget> {
              @override
              Widget build(Object context) => Container();
            }
          ''',
        },
        outputs: {
          'flutter|lib/msr_widgets.g.dart': anything, // Flutter mock package output
          'test_pkg2|lib/msr_widgets.g.dart': decodedMatches(allOf([
            contains('MyStatefulWidget'),
            isNot(contains('_MyStatefulWidgetState')), // Private widgets excluded
          ])),
        },

      );
    });

    test('excludes base Flutter widget types', () async {
      final builder = WidgetAnalyzerBuilder(
        buildExtensions: {r'$lib$': ['msr_widgets.g.dart']},
      );

      await testBuilder(
        builder,
        {
          'flutter|lib/widgets.dart': mockFlutterWidgets,
          'test_pkg3|lib/my_widget.dart': '''
            import 'package:flutter/widgets.dart';

            class MyWidget extends StatelessWidget {
              const MyWidget();

              @override
              Widget build(Object context) => Container();
            }
          ''',
        },
        outputs: {
          'flutter|lib/msr_widgets.g.dart': anything, // Flutter mock package output
          'test_pkg3|lib/msr_widgets.g.dart': decodedMatches(allOf([
            contains('MyWidget'),
            isNot(contains("Widget: 'Widget'")),
            isNot(contains("StatelessWidget: 'StatelessWidget'")),
            isNot(contains("StatefulWidget: 'StatefulWidget'")),
          ])),
        },

      );
    });

    test('handles multiple widgets in single file', () async {
      final builder = WidgetAnalyzerBuilder(
        buildExtensions: {r'$lib$': ['msr_widgets.g.dart']},
      );

      await testBuilder(
        builder,
        {
          'flutter|lib/widgets.dart': mockFlutterWidgets,
          'test_pkg4|lib/widgets.dart': '''
            import 'package:flutter/widgets.dart';

            class WidgetA extends StatelessWidget {
              const WidgetA();
              @override
              Widget build(Object context) => Container();
            }

            class WidgetB extends StatelessWidget {
              const WidgetB();
              @override
              Widget build(Object context) => Container();
            }

            class WidgetC extends StatefulWidget {
              const WidgetC();
            }
          ''',
        },
        outputs: {
          'flutter|lib/msr_widgets.g.dart': anything, // Flutter mock package output
          'test_pkg4|lib/msr_widgets.g.dart': decodedMatches(allOf([
            contains('WidgetA'),
            contains('WidgetB'),
            contains('WidgetC'),
          ])),
        },

      );
    });

    test('sorts widgets alphabetically', () async {
      final builder = WidgetAnalyzerBuilder(
        buildExtensions: {r'$lib$': ['msr_widgets.g.dart']},
      );

      await testBuilder(
        builder,
        {
          'flutter|lib/widgets.dart': mockFlutterWidgets,
          'test_pkg5|lib/widgets.dart': '''
            import 'package:flutter/widgets.dart';

            class ZWidget extends StatelessWidget {
              const ZWidget();
              @override
              Widget build(Object context) => Container();
            }

            class AWidget extends StatelessWidget {
              const AWidget();
              @override
              Widget build(Object context) => Container();
            }

            class MWidget extends StatelessWidget {
              const MWidget();
              @override
              Widget build(Object context) => Container();
            }
          ''',
        },
        outputs: {
          'flutter|lib/msr_widgets.g.dart': anything, // Flutter mock package output
          'test_pkg5|lib/msr_widgets.g.dart': decodedMatches(
            matches(RegExp(r'AWidget.*MWidget.*ZWidget', dotAll: true)),
          ),
        },

      );
    });

    test('skips .g.dart files', () async {
      final builder = WidgetAnalyzerBuilder(
        buildExtensions: {r'$lib$': ['msr_widgets.g.dart']},
      );

      await testBuilder(
        builder,
        {
          'flutter|lib/widgets.dart': mockFlutterWidgets,
          'test_pkg6|lib/my_widget.dart': '''
            import 'package:flutter/widgets.dart';

            class RealWidget extends StatelessWidget {
              const RealWidget();
              @override
              Widget build(Object context) => Container();
            }
          ''',
          'test_pkg6|lib/generated.g.dart': '''
            import 'package:flutter/widgets.dart';

            class GeneratedWidget extends StatelessWidget {
              const GeneratedWidget();
              @override
              Widget build(Object context) => Container();
            }
          ''',
        },
        outputs: {
          'flutter|lib/msr_widgets.g.dart': anything, // Flutter mock package output
          'test_pkg6|lib/msr_widgets.g.dart': decodedMatches(allOf([
            contains('RealWidget'),
            isNot(contains('GeneratedWidget')),
          ])),
        },

      );
    });

    test('generates correct file structure', () async {
      final builder = WidgetAnalyzerBuilder(
        buildExtensions: {r'$lib$': ['msr_widgets.g.dart']},
      );

      await testBuilder(
        builder,
        {
          'flutter|lib/widgets.dart': mockFlutterWidgets,
          'test_pkg7|lib/my_widget.dart': '''
            import 'package:flutter/widgets.dart';

            class TestWidget extends StatelessWidget {
              const TestWidget();
              @override
              Widget build(Object context) => Container();
            }
          ''',
        },
        outputs: {
          'flutter|lib/msr_widgets.g.dart': anything, // Flutter mock package output
          'test_pkg7|lib/msr_widgets.g.dart': decodedMatches(allOf([
            contains('// GENERATED CODE - DO NOT MODIFY BY HAND'),
            contains('// ignore_for_file: unused_import, implementation_imports'),
            contains('const Map<Type, String> widgetFilter = {'),
            contains("TestWidget: 'TestWidget',"),
            contains('};'),
          ])),
        },

      );
    });

    test('supports custom variable name', () async {
      final builder = WidgetAnalyzerBuilder(
        buildExtensions: {r'$lib$': ['msr_widgets.g.dart']},
        variableName: 'customWidgetFilter',
      );

      await testBuilder(
        builder,
        {
          'flutter|lib/widgets.dart': mockFlutterWidgets,
          'test_pkg8|lib/my_widget.dart': '''
            import 'package:flutter/widgets.dart';

            class MyCustomWidget extends StatelessWidget {
              const MyCustomWidget();
              @override
              Widget build(Object context) => Container();
            }
          ''',
        },
        outputs: {
          'flutter|lib/msr_widgets.g.dart': anything, // Flutter mock package output
          'test_pkg8|lib/msr_widgets.g.dart': decodedMatches(allOf([
            contains('const Map<Type, String> customWidgetFilter = {'),
            contains("MyCustomWidget: 'MyCustomWidget',"),
            isNot(contains('widgetFilter = {')),
          ])),
        },

      );
    });
  });
}
