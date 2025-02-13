import '../method_channel/method_constants.dart';

/// Represents an exception in Measure. This is used to track handled and unhandled exceptions.
class ExceptionData {
  /// A list of exceptions that were thrown. Multiple exceptions represent "chained" exceptions.
  final List<ExceptionUnit> exceptions;

  /// Whether the exception was handled or not.
  final bool handled;

  ExceptionData({
    required this.exceptions,
    required this.handled,
  });

  Map<String, dynamic> toJson() {
    return _serializeExceptionData(this);
  }

  Map<String, dynamic> _serializeExceptionData(ExceptionData data) {
    return {
      MethodConstants.argExceptionDataExceptions:
      data.exceptions.map((e) => _serializeExceptionUnit(e)).toList(),
      MethodConstants.argExceptionDataHandled: data.handled,
    };
  }

  Map<String, dynamic> _serializeExceptionUnit(ExceptionUnit unit) {
    return {
      MethodConstants.argExceptionDataUnitType: unit.type,
      MethodConstants.argExceptionDataUnitMessage: unit.message,
      MethodConstants.argExceptionDataUnitFrames:
      unit.frames.map((f) => _serializeFrame(f)).toList(),
    };
  }

  Map<String, dynamic> _serializeFrame(MsrFrame frame) {
    return {
      MethodConstants.argExceptionDataFrameClassName: frame.className,
      MethodConstants.argExceptionDataFrameMethodName: frame.methodName,
      MethodConstants.argExceptionDataFrameFileName: frame.fileName,
      MethodConstants.argExceptionDataFrameLineNum: frame.lineNum,
      MethodConstants.argExceptionDataFrameModuleName: frame.moduleName,
      MethodConstants.argExceptionDataFrameColNum: frame.colNum,
      MethodConstants.argExceptionDataFrameIndex: frame.frameIndex,
      MethodConstants.argExceptionDataFrameBinaryAddr: frame.binaryAddr,
      MethodConstants.argExceptionDataFrameSymbolAddr: frame.symbolAddress,
    };
  }
}

/// Represents a stacktrace in Measure.
class ExceptionUnit {
  /// The fully qualified type of the exception. For example, java.lang.Exception.
  final String? type;

  /// A message which describes the exception.
  final String? message;

  /// A list of stack frames for the exception.
  final List<MsrFrame> frames;

  ExceptionUnit({
    this.type,
    this.message,
    required this.frames,
  });
}

/// Represents a stackframe in Measure.
class MsrFrame {
  /// The fully qualified class name.
  final String? className;

  /// The name of the method in the stacktrace.
  final String? methodName;

  /// The name of the source file in the stacktrace.
  final String? fileName;

  /// The line number of the method called.
  final int? lineNum;

  final String? moduleName;

  final int? colNum;

  final int? frameIndex;

  final String? binaryAddr;

  final String? symbolAddress;

  MsrFrame({
    this.className,
    this.methodName,
    this.fileName,
    this.lineNum,
    this.moduleName,
    this.colNum,
    this.frameIndex,
    this.binaryAddr,
    this.symbolAddress,
  });
}