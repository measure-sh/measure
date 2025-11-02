import 'dart:async';

import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/dart/element/element.dart';
import 'package:analyzer/dart/element/type.dart';
import 'package:build/build.dart';
import 'package:glob/glob.dart';

const String kDefaultOutputPath = 'lib/msr_widgets.g.dart';
const List<String> kDefaultScanDirectories = ['lib'];
const String kLibPrefix = 'lib/';
const int kLibPrefixLength = 4; // Length of 'lib/'

const String _kSyntheticInputSuffix = r'lib/$lib$';
const String _kGeneratedFilePattern = '.g.dart';
const String _kDartFileGlob = '/**.dart';

const Set<String> _kExcludedWidgets = {
  'Widget',
  'StatelessWidget',
  'StatefulWidget',
};

const Set<String> _kFlutterBaseWidgetTypes = {
  'Widget',
  'StatelessWidget',
  'StatefulWidget',
  'InheritedWidget',
  'RenderObjectWidget',
  'ProxyWidget',
};

const String kDefaultVariableName = 'widgetFilter';
const String _kGeneratedFileHeader = '// GENERATED CODE - DO NOT MODIFY BY HAND';
const String _kGeneratedFileIgnoreDirective = '// ignore_for_file: unused_import, implementation_imports';

const String _kPackageUriPrefix = 'package:';
const String _kDartUriPrefix = 'dart:';
const String _kFileUriPrefix = 'file:';
const String _kLibPathSeparator = '/lib/';
const String _kFlutterLibraryIdentifier = 'flutter';

/// Finds all Flutter widgets used in a project and writes them
/// to a dart file as a map of widget name to class name.
///
/// This builder scans all Dart files in configured directories (defaults to `lib`),
/// analyzes classes, methods, and their instantiations to discover
/// all widgets that extend from Flutter's base `Widget` class.
///
/// By default, the generated dart file is written to
/// `lib/msr_widgets.g.dart` and contains a const map named
/// `widgetFilter` that maps widget types to their names.
///
/// ## Configuration
///
/// Configure the builder in your `pubspec.yaml`:
///
/// ```yaml
/// measure_build:
///   widget_analyzer:
///     # Optional: Custom output path (defaults to 'lib/msr_widgets.g.dart')
///     output_path: lib/src/msr/msr_widgets.g.dart
///     # Optional: Directories to scan (defaults to ['lib'])
///     scan_directories:
///       - lib
///       - path/foo/bar/
///     # Optional: Variable name for the generated map (defaults to 'widgetFilter')
///     variable_name: customWidgetFilter
/// ```
///
/// ## Usage
///
/// The result can be plugged into Measure SDK initialization in the following way:
///
/// ```dart
/// final config = MeasureConfig(
///  widgetFilter: widgetFilter,
/// )
/// Measure.init(context, config)
/// ```
class WidgetAnalyzerBuilder extends Builder {
  @override
  final Map<String, List<String>> buildExtensions;

  final String outputPath;
  final List<String> scanDirectories;
  final String variableName;

  WidgetAnalyzerBuilder({
    required this.buildExtensions,
    this.outputPath = kDefaultOutputPath,
    this.scanDirectories = kDefaultScanDirectories,
    this.variableName = kDefaultVariableName,
  });

  @override
  FutureOr<void> build(BuildStep buildStep) async {
    // Only run on lib/$lib$ synthetic input
    if (!buildStep.inputId.path.endsWith(_kSyntheticInputSuffix)) {
      return;
    }

    final allWidgets = <String, InterfaceElement>{};

    // Scan all configured directories
    for (final directory in scanDirectories) {
      final dartFiles = Glob('$directory$_kDartFileGlob');
      await for (final input in buildStep.findAssets(dartFiles)) {
        if (input.path.contains(_kGeneratedFilePattern) || input.path == outputPath) {
          continue;
        }
        try {
          final resolver = buildStep.resolver;
          if (!await resolver.isLibrary(input)) {
            continue;
          }
          final library = await resolver.libraryFor(input);
          for (final classElement in library.topLevelElements.whereType<ClassElement>()) {
            if (_isWidgetClass(classElement)) {
              final name = classElement.name;
              if (!_isPrivateWidget(name)) {
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
    allWidgets.removeWhere((name, element) => _kExcludedWidgets.contains(name));
    final outputId = AssetId(buildStep.inputId.package, outputPath);
    final dartCode = _generateDartFile(allWidgets, buildStep.inputId.package, variableName);
    await buildStep.writeAsString(outputId, dartCode);
    log.info('Generated $outputPath with ${allWidgets.length} widgets');
  }

  bool _isWidgetClass(ClassElement element) {
    return _checkExtendsWidgetRecursively(element, <InterfaceElement>{});
  }

  Future<void> _scanLibraryForWidgets(LibraryElement library, Map<String, InterfaceElement> widgets) async {
    for (final element in library.topLevelElements.whereType<ClassElement>()) {
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
        for (final param in method.parameters) {
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
        if (!_isPrivateWidget(name)) {
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

  String _generateDartFile(Map<String, InterfaceElement> widgets, String packageName, String variableName) {
    final buffer = StringBuffer();
    final imports = <String>{};

    for (final element in widgets.values) {
      final libraryUri = element.source.uri.toString();

      if (libraryUri.startsWith(_kPackageUriPrefix) || libraryUri.startsWith(_kDartUriPrefix)) {
        imports.add("import '$libraryUri';");
      } else if (libraryUri.startsWith(_kFileUriPrefix) && libraryUri.contains(_kLibPathSeparator)) {
        final libPath = libraryUri.split(_kLibPathSeparator).last;
        imports.add("import '$_kPackageUriPrefix$packageName/$libPath';");
      }
    }

    // Write header comment
    buffer.writeln(_kGeneratedFileHeader);
    buffer.writeln(_kGeneratedFileIgnoreDirective);
    buffer.writeln();

    // Write imports
    final sortedImports = imports.toList()..sort();
    for (final import in sortedImports) {
      buffer.writeln(import);
    }
    buffer.writeln();

    // Write the map
    buffer.writeln('const Map<Type, String> $variableName = {');

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
    final library = libraryElement.source.uri.toString();

    if (element.name == 'Widget' && library.contains(_kFlutterLibraryIdentifier)) {
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

  bool _isPrivateWidget(String name) {
    return name.startsWith('_');
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
        if (!name.startsWith('_')) {
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
    final library = libraryElement.source.uri.toString();

    if (element.name == 'Widget' && library.contains(_kFlutterLibraryIdentifier)) {
      return true;
    }

    if (_kFlutterBaseWidgetTypes.contains(element.name) && library.contains(_kFlutterLibraryIdentifier)) {
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
