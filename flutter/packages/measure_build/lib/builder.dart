import 'package:build/build.dart';
import 'package:msr_build/src/builders/widget_analyzer_builder.dart';

Builder widgetAnalyzerBuilder(BuilderOptions options) {
  // Read widgets_output_path from options, default to 'lib/msr_widgets.g.dart'
  final outputPath = options.config['widgets_output_path'] as String? ?? 'lib/msr_widgets.g.dart';

  // Read scan_directories from options, default to ['lib']
  final scanDirs = options.config['scan_directories'];
  final List<String> scanDirectories;
  if (scanDirs is List) {
    scanDirectories = scanDirs.cast<String>();
  } else {
    scanDirectories = ['lib'];
  }

  // Extract the path relative to lib/ for buildExtensions
  // If outputPath is 'lib/src/msr/msr_widgets.g.dart', we need 'src/msr/msr_widgets.g.dart'
  final relativePath = outputPath.startsWith('lib/')
      ? outputPath.substring(4) // Remove 'lib/' prefix
      : outputPath;

  return WidgetAnalyzerBuilder(
    buildExtensions: {
      r'$lib$': [relativePath],
    },
    outputPath: outputPath,
    scanDirectories: scanDirectories,
  );
}