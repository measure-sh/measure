# measure_build

`measure_build` scans your Flutter project and generates a map of all widget types that extend from
Flutter's base `Widget` class. This generated map is used by the Measure SDK to capture layout
snapshots with proper widget type information.

* [Usage](#usage)
* [Configuration](#configuration)

## Usage

### 1. Install

Add `measure_build` as a dev dependency:

```yaml
dev_dependencies:
  measure_build: ^0.1.0
  build_runner: ^2.4.0
```

### 2. Run the code generator

```bash
dart run build_runner build
```

This generates `lib/msr_widgets.g.dart` containing a map named `widgetFilter`.

### 3. Use in Measure SDK initialization

Import the generated file and pass the map to your Measure configuration:

```dart
import 'package:your_app/msr_widgets.g.dart';
import 'package:measure_flutter/measure_flutter.dart';

final config = MeasureConfig(
  widgetFilter: widgetFilter,
);
```

## Configuration

You can customize the builder's behavior in `build.yaml`:

```yaml
targets:
  $default:
    builders:
      measure_build|widget_analyzer:
        # Custom output path (default: 'lib/msr_widgets.g.dart')
        output_path: lib/src/msr/msr_widgets.g.dart

        # Directories to scan for widgets (default: ['lib'])
        scan_directories:
          - lib
          - custom_widgets
        
        # Variable name for the generated map (default: 'widgetFilter')
        variable_name: msrWidgetFilter
```

* `output_path` — the path where the generated file will be saved. Defaults to '
  lib/msr_widgets.g.dart'.
* `scan_directories` — a list of directories to scan for widgets. Defaults to ['lib'].
* `variable_name` — the variable name of the generated map. Defaults to 'widgetFilter'.
