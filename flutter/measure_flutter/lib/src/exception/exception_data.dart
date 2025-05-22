import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/src/serialization/json_serializable.dart';

part 'exception_data.g.dart';

/// Represents an exception in Measure. This is used to track handled and unhandled exceptions.
@JsonSerializable(explicitToJson: true)
class ExceptionData implements JsonSerialized {
  /// A list of exceptions that were thrown. Multiple exceptions represent "chained" exceptions.
  final List<ExceptionUnit> exceptions;

  /// Whether the exception was handled or not.
  final bool handled;

  /// The stacktrace of all the threads at the time of the exception.
  final List<MeasureThread> threads;

  /// Whether the app was in the foreground or not when the exception occurred.
  final bool foreground;

  @JsonKey(name: "binary_images")
  final List<BinaryImage> binaryImages;

  /// The framework where the exception originated in.
  final String framework;

  ExceptionData({
    required this.exceptions,
    required this.handled,
    required this.threads,
    required this.foreground,
    required this.binaryImages,
    required this.framework,
  });

  @override
  Map<String, dynamic> toJson() => _$ExceptionDataToJson(this);

  factory ExceptionData.fromJson(Map<String, dynamic> json) =>
      _$ExceptionDataFromJson(json);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ExceptionData &&
          runtimeType == other.runtimeType &&
          exceptions == other.exceptions &&
          handled == other.handled &&
          threads == other.threads &&
          foreground == other.foreground &&
          binaryImages == other.binaryImages &&
          framework == other.framework;

  @override
  int get hashCode =>
      exceptions.hashCode ^
      handled.hashCode ^
      threads.hashCode ^
      foreground.hashCode ^
      binaryImages.hashCode ^
      framework.hashCode;
}

@JsonSerializable(explicitToJson: true)
class MeasureThread {
  final String name;
  final List<MsrFrame> frames;

  MeasureThread({required this.name, required this.frames});

  Map<String, dynamic> toJson() => _$MeasureThreadToJson(this);

  factory MeasureThread.fromJson(Map<String, dynamic> json) =>
      _$MeasureThreadFromJson(json);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MeasureThread &&
          runtimeType == other.runtimeType &&
          name == other.name &&
          frames == other.frames;

  @override
  int get hashCode => name.hashCode ^ frames.hashCode;
}

/// Represents a stacktrace in Measure.
@JsonSerializable(explicitToJson: true)
class ExceptionUnit {
  /// The fully qualified type of the exception. For example, java.lang.Exception.
  final String? type;

  /// A message which describes the exception.
  final String? message;

  /// A list of stack frames for the exception.
  final List<MsrFrame> frames;

  @JsonKey(name: 'thread_name')
  final String? threadName;

  @JsonKey(name: 'thread_sequence')
  final int threadSequence;

  @JsonKey(name: 'os_build_number')
  final String? osBuildNumber;

  ExceptionUnit({
    this.type,
    this.message,
    this.threadName,
    this.threadSequence = 0,
    this.osBuildNumber,
    required this.frames,
  });

  Map<String, dynamic> toJson() => _$ExceptionUnitToJson(this);

  factory ExceptionUnit.fromJson(Map<String, dynamic> json) =>
      _$ExceptionUnitFromJson(json);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ExceptionUnit &&
          runtimeType == other.runtimeType &&
          type == other.type &&
          message == other.message &&
          frames == other.frames &&
          threadName == other.threadName &&
          threadSequence == other.threadSequence &&
          osBuildNumber == other.osBuildNumber;

  @override
  int get hashCode =>
      type.hashCode ^
      message.hashCode ^
      frames.hashCode ^
      threadName.hashCode ^
      threadSequence.hashCode ^
      osBuildNumber.hashCode;
}

/// Represents a stack frame in Measure.
@JsonSerializable()
class MsrFrame {
  /// The fully qualified class name.
  @JsonKey(name: 'class_name')
  final String? className;

  /// The name of the method.
  @JsonKey(name: 'method_name')
  final String? methodName;

  /// The name of the source file.
  @JsonKey(name: 'file_name')
  final String? fileName;

  /// The line number.
  @JsonKey(name: 'line_num')
  final int? lineNum;

  /// The name of the module or library.
  @JsonKey(name: 'module_name')
  final String? moduleName;

  /// The column number.
  @JsonKey(name: 'col_num')
  final int? colNum;

  /// The index of the frame in the stack trace.
  @JsonKey(name: 'frame_index')
  final int? frameIndex;

  /// The binary address of the frame.
  @JsonKey(name: 'binary_address')
  final String? binaryAddress;

  /// The symbol address of the frame.
  @JsonKey(name: 'symbol_address')
  final String? symbolAddress;

  /// The instruction address of the frame.
  @JsonKey(name: 'instruction_address')
  final String? instructionAddress;

  /// `true` if the frame originates from the app module
  /// Defaults to false.
  @JsonKey(name: "in_app")
  final bool inApp;

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
    this.inApp = false,
  });

  Map<String, dynamic> toJson() => _$MsrFrameToJson(this);

  factory MsrFrame.fromJson(Map<String, dynamic> json) =>
      _$MsrFrameFromJson(json);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MsrFrame &&
          runtimeType == other.runtimeType &&
          className == other.className &&
          methodName == other.methodName &&
          fileName == other.fileName &&
          lineNum == other.lineNum &&
          moduleName == other.moduleName &&
          colNum == other.colNum &&
          frameIndex == other.frameIndex &&
          binaryAddress == other.binaryAddress &&
          symbolAddress == other.symbolAddress &&
          instructionAddress == other.instructionAddress &&
          inApp == other.inApp;

  @override
  int get hashCode =>
      className.hashCode ^
      methodName.hashCode ^
      fileName.hashCode ^
      lineNum.hashCode ^
      moduleName.hashCode ^
      colNum.hashCode ^
      frameIndex.hashCode ^
      binaryAddress.hashCode ^
      symbolAddress.hashCode ^
      instructionAddress.hashCode ^
      inApp.hashCode;
}

@JsonSerializable()
class BinaryImage {
  @JsonKey(name: 'base_addr')
  final String baseAddr;
  final String uuid;
  final String arch;

  BinaryImage({
    required this.baseAddr,
    required this.uuid,
    required this.arch,
  });

  Map<String, dynamic> toJson() => _$BinaryImageToJson(this);

  factory BinaryImage.fromJson(Map<String, dynamic> json) =>
      _$BinaryImageFromJson(json);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BinaryImage &&
          runtimeType == other.runtimeType &&
          baseAddr == other.baseAddr &&
          uuid == other.uuid &&
          arch == other.arch;

  @override
  int get hashCode => baseAddr.hashCode ^ uuid.hashCode ^ arch.hashCode;
}
