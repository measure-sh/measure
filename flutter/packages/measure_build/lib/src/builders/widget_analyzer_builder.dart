import 'dart:async';

import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/dart/element/element.dart';
import 'package:analyzer/dart/element/type.dart';
import 'package:build/build.dart';
import 'package:glob/glob.dart';

/// Finds all Flutter widgets used in a project and writes them
/// to a dart file as a map of widget name to class name.
///
/// This builder scans all Dart files in configured directories (defaults to `lib`),
/// analyzes classes, methods, and their instantiations to discover
/// all widgets that extend from Flutter's base `Widget` class.
///
/// By default, the generated dart file is written to
/// `lib/msr_widgets.g.dart` and contains a const map named
/// `msrWidgetsForLayoutSnapshot` that maps widget types to their names.
///
/// ## Configuration
///
/// Configure the builder in your `pubspec.yaml`:
///
/// ```yaml
/// msr_build:
///   widget_analyzer:
///     # Optional: Custom output path (defaults to 'lib/msr_widgets.g.dart')
///     widgets_output_path: lib/src/msr/msr_widgets.g.dart
///     # Optional: Directories to scan (defaults to ['lib'])
///     scan_directories:
///       - lib
///       - custom_widgets
/// ```
///
/// ## Usage
///
/// The result can be plugged into Measure SDK initialization in the following way:
///
/// ```dart
/// final config = MeasureConfig(
///  layoutSnapshotWidgetTypes: msrWidgetsForLayoutSnapshot,
/// )
/// Measure.init(context, config)
/// ```
class WidgetAnalyzerBuilder extends Builder {
  @override
  final Map<String, List<String>> buildExtensions;

  final String outputPath;
  final List<String> scanDirectories;

  WidgetAnalyzerBuilder({
    required this.buildExtensions,
    this.outputPath = 'lib/msr_widgets.g.dart',
    this.scanDirectories = const ['lib'],
  });

  @override
  FutureOr<void> build(BuildStep buildStep) async {
    // Only run on lib/$lib$ synthetic input
    if (!buildStep.inputId.path.endsWith(r'lib/$lib$')) {
      return;
    }

    final allWidgets = <String, InterfaceElement>{};

    // Scan all configured directories
    for (final directory in scanDirectories) {
      final dartFiles = Glob('$directory/**.dart');
      await for (final input in buildStep.findAssets(dartFiles)) {
        if (input.path.contains('.g.dart') || input.path == outputPath) {
          continue;
        }
      try {
        final resolver = buildStep.resolver;
        if (!await resolver.isLibrary(input)) {
          continue;
        }
        final library = await resolver.libraryFor(input);
        for (final classElement in library.classes) {
          if (_isWidgetClass(classElement)) {
            final name = classElement.name;
            if (name != null) {
              allWidgets[name] = classElement;
            }
          }
        }
        await _scanLibraryForWidgets(library, allWidgets);
      } catch (e) {
        log.warning('Error processing ${input.path}: $e');
      }
    }
    }
    allWidgets
        .removeWhere((name, element) => name == 'Widget' || name == 'StatelessWidget' || name == 'StatefulWidget');
    final outputId = AssetId(buildStep.inputId.package, outputPath);
    final dartCode = _generateDartFile(allWidgets, buildStep.inputId.package);
    await buildStep.writeAsString(outputId, dartCode);
    log.info('Generated $outputPath with ${allWidgets.length} widgets');
  }

  bool _isWidgetClass(ClassElement element) {
    return _checkExtendsWidgetRecursively(element, <InterfaceElement>{});
  }

  Future<void> _scanLibraryForWidgets(LibraryElement library, Map<String, InterfaceElement> widgets) async {
    for (final element in library.classes) {
      final supertype = element.supertype;
      if (supertype != null) {
        _checkTypeForWidgets(supertype, widgets);
      }

      for (final mixin in element.mixins) {
        _checkTypeForWidgets(mixin, widgets);
      }

      for (final field in element.fields) {
        _checkTypeForWidgets(field.type, widgets);
      }
      for (final method in element.methods) {
        _checkTypeForWidgets(method.returnType, widgets);
        for (final param in method.formalParameters) {
          _checkTypeForWidgets(param.type, widgets);
        }

        final session = element.library.session;
        try {
          final result = await session.getResolvedLibraryByElement(element.library);
          if (result is ResolvedLibraryResult) {
            for (final unit in result.units) {
              for (final declaration in unit.unit.declarations) {
                if (declaration is ClassDeclaration) {
                  for (final member in declaration.members) {
                    if (member is MethodDeclaration && member.name.lexeme == method.name) {
                      final visitor = _MethodBodyVisitor();
                      member.accept(visitor);
                      widgets.addAll(visitor.widgets);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore errors getting AST
        }
      }
    }
  }

  void _checkTypeForWidgets(DartType type, Map<String, InterfaceElement> widgets) {
    final element = type.element;
    if (element is InterfaceElement) {
      if (_checkExtendsWidgetRecursively(element, <InterfaceElement>{})) {
        final name = element.name;
        if (name != null) {
          widgets[name] = element;
        }
      }
    }

    // Also check generic type arguments
    if (type is ParameterizedType) {
      for (final typeArg in type.typeArguments) {
        _checkTypeForWidgets(typeArg, widgets);
      }
    }
  }

  String _generateDartFile(Map<String, InterfaceElement> widgets, String packageName) {
    final buffer = StringBuffer();
    final imports = <String>{};

    for (final element in widgets.values) {
      final libraryUri = element.library.firstFragment.source.uri.toString();

      if (libraryUri.startsWith('package:') || libraryUri.startsWith('dart:')) {
        imports.add("import '$libraryUri';");
      } else if (libraryUri.startsWith('file:') && libraryUri.contains('/lib/')) {
        final libPath = libraryUri.split('/lib/').last;
        imports.add("import 'package:$packageName/$libPath';");
      }
    }

    // Write header comment
    buffer.writeln('// GENERATED CODE - DO NOT MODIFY BY HAND');
    buffer.writeln('// ignore_for_file: unused_import, implementation_imports');
    buffer.writeln();

    // Write imports
    final sortedImports = imports.toList()..sort();
    for (final import in sortedImports) {
      buffer.writeln(import);
    }
    buffer.writeln();

    // Write the map
    buffer.writeln('const Map<Type, String> msrWidgetsForLayoutSnapshot = {');

    final sortedWidgets = widgets.keys.toList()..sort();
    for (final widgetName in sortedWidgets) {
      buffer.writeln('  $widgetName: \'$widgetName\',');
    }

    buffer.writeln('};');

    return buffer.toString();
  }

  bool _checkExtendsWidgetRecursively(InterfaceElement element, Set<InterfaceElement> visited) {
    if (!visited.add(element)) {
      return false;
    }

    final libraryElement = element.library;
    final library = libraryElement.firstFragment.source.uri.toString();

    if (element.name == 'Widget' && library.contains('flutter')) {
      return true;
    }

    if (element is ClassElement) {
      final supertype = element.supertype;
      if (supertype != null) {
        if (_checkExtendsWidgetRecursively(supertype.element, visited)) {
          return true;
        }
      }

      for (final mixin in element.mixins) {
        if (_checkExtendsWidgetRecursively(mixin.element, visited)) {
          return true;
        }
      }
    }

    return false;
  }
}

/// AST visitor for method bodies to find widget instantiations
class _MethodBodyVisitor extends RecursiveAstVisitor<void> {
  final Map<String, InterfaceElement> widgets = {};

  @override
  void visitInstanceCreationExpression(InstanceCreationExpression node) {
    final type = node.staticType;
    if (type != null && _isWidget(type)) {
      final element = type.element;
      if (element is InterfaceElement) {
        final name = element.name;
        if (name != null) {
          widgets[name] = element;
        }
      }
    }
    super.visitInstanceCreationExpression(node);
  }

  bool _isWidget(DartType type) {
    final element = type.element;
    if (element is! InterfaceElement) {
      return false;
    }

    return _extendsWidget(element, <InterfaceElement>{});
  }

  bool _extendsWidget(InterfaceElement element, Set<InterfaceElement> visited) {
    if (!visited.add(element)) {
      return false;
    }

    final libraryElement = element.library;
    final library = libraryElement.firstFragment.source.uri.toString();

    if (element.name == 'Widget' && library.contains('flutter')) {
      return true;
    }

    if ((element.name == 'StatelessWidget' ||
            element.name == 'StatefulWidget' ||
            element.name == 'InheritedWidget' ||
            element.name == 'RenderObjectWidget' ||
            element.name == 'ProxyWidget') &&
        library.contains('flutter')) {
      return true;
    }

    if (element is ClassElement) {
      final supertype = element.supertype;
      if (supertype != null) {
        final supertypeElement = supertype.element;
        if (_extendsWidget(supertypeElement, visited)) {
          return true;
        }
      }

      for (final mixin in element.mixins) {
        final mixinElement = mixin.element;
        if (_extendsWidget(mixinElement, visited)) {
          return true;
        }
      }
    }

    return false;
  }
}
