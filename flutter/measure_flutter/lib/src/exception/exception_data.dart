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
      MethodConstants.exceptionExceptions:
      data.exceptions.map((e) => _serializeExceptionUnit(e)).toList(),
      MethodConstants.exceptionHandled: data.handled,
    };
  }

  Map<String, dynamic> _serializeExceptionUnit(ExceptionUnit unit) {
    return {
      MethodConstants.exceptionType: unit.type,
      MethodConstants.exceptionMessage: unit.message,
      MethodConstants.exceptionFrames:
      unit.frames.map((f) => _serializeFrame(f)).toList(),
    };
  }

  Map<String, dynamic> _serializeFrame(MsrFrame frame) {
    return {
      MethodConstants.exceptionFrameClassName: frame.className,
      MethodConstants.exceptionFrameMethodName: frame.methodName,
      MethodConstants.exceptionFrameFileName: frame.fileName,
      MethodConstants.exceptionFrameLineNum: frame.lineNum,
      MethodConstants.exceptionFrameModuleName: frame.moduleName,
      MethodConstants.exceptionFrameColNum: frame.colNum,
      MethodConstants.exceptionFrameIndex: frame.frameIndex,
      MethodConstants.exceptionFrameBinaryAddress: frame.binaryAddress,
      MethodConstants.exceptionFrameInstructionAddress: frame.instructionAddress,
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

/// Represents a stack frame in Measure.
class MsrFrame {
  /// The fully qualified class name.
  final String? className;

  /// The name of the method.
  final String? methodName;

  /// The name of the source file.
  final String? fileName;

  /// The line number.
  final int? lineNum;

  /// The name of the module or library.
  final String? moduleName;

  /// The column number.
  final int? colNum;

  /// The index of the frame in the stack trace.
  final int? frameIndex;

  /// The binary address of the frame.
  final String? binaryAddress;

  /// The symbol address of the frame.
  final String? symbolAddress;

  /// The instruction address of the frame.
  final String? instructionAddress;

  MsrFrame({
    this.className,
    this.methodName,
    this.fileName,
    this.lineNum,
    this.moduleName,
    this.colNum,
    this.frameIndex,
    this.binaryAddress,
    this.symbolAddress,
    this.instructionAddress,
  });
}