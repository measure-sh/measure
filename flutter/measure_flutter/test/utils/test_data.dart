import 'package:measure_flutter/src/exception/exception_data.dart';

final class TestData {
  const TestData._();

  static ExceptionData getExceptionData({bool handled = true}) {
    return ExceptionData(
      handled: handled,
      threads: [],
      foreground: true,
      exceptions: [
        ExceptionUnit(
          type: 'dart.core.NoSuchMethodError',
          message: 'The getter \'length\' was called on null',
          frames: [
            MsrFrame(
              className: 'UserProfileWidget',
              methodName: 'build',
              fileName: 'user_profile_widget.dart',
              lineNum: 42,
              moduleName: 'my_app',
              colNum: 15,
            ),
            MsrFrame(
              className: 'StatelessWidget',
              methodName: 'build',
              fileName: 'framework.dart',
              lineNum: 8865,
              moduleName: 'flutter',
              colNum: 29,
            ),
            MsrFrame(
              className: 'BuildOwner',
              methodName: 'buildScope',
              fileName: 'framework.dart',
              lineNum: 2615,
              moduleName: 'flutter',
              colNum: 13,
            ),
            MsrFrame(
              className: 'Element',
              methodName: 'rebuild',
              fileName: 'framework.dart',
              lineNum: 4991,
              moduleName: 'flutter',
              colNum: 5,
            ),
          ],
        ),
      ],
    );
  }
}
