import 'package:build/build.dart';
import 'package:measure_build/src/builders/widget_analyzer_builder.dart';

Builder widgetAnalyzerBuilder(BuilderOptions options) {
  final outputPath = options.config['output_path'] as String? ?? kDefaultOutputPath;
  final scanDirs = options.config['scan_directories'];
  final List<String> scanDirectories;
  if (scanDirs is List) {
    scanDirectories = scanDirs.cast<String>();
  } else {
    scanDirectories = kDefaultScanDirectories;
  }
  final variableName = options.config['variable_name'] as String? ?? kDefaultVariableName;
  final relativePath = outputPath.startsWith(kLibPrefix) ? outputPath.substring(kLibPrefixLength) : outputPath;

  return WidgetAnalyzerBuilder(
    buildExtensions: {
      r'$lib$': [relativePath],
    },
    outputPath: outputPath,
    scanDirectories: scanDirectories,
    variableName: variableName,
  );
}
