// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'exception_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ExceptionData _$ExceptionDataFromJson(Map<String, dynamic> json) =>
    ExceptionData(
      exceptions: (json['exceptions'] as List<dynamic>)
          .map((e) => ExceptionUnit.fromJson(e as Map<String, dynamic>))
          .toList(),
      handled: json['handled'] as bool,
      threads: (json['threads'] as List<dynamic>)
          .map((e) => MeasureThread.fromJson(e as Map<String, dynamic>))
          .toList(),
      foreground: json['foreground'] as bool,
      binaryImages: (json['binary_images'] as List<dynamic>)
          .map((e) => BinaryImage.fromJson(e as Map<String, dynamic>))
          .toList(),
      framework: json['framework'] as String,
    );

Map<String, dynamic> _$ExceptionDataToJson(ExceptionData instance) =>
    <String, dynamic>{
      'exceptions': instance.exceptions.map((e) => e.toJson()).toList(),
      'handled': instance.handled,
      'threads': instance.threads.map((e) => e.toJson()).toList(),
      'foreground': instance.foreground,
      'binary_images': instance.binaryImages.map((e) => e.toJson()).toList(),
      'framework': instance.framework,
    };

MeasureThread _$MeasureThreadFromJson(Map<String, dynamic> json) =>
    MeasureThread(
      name: json['name'] as String,
      frames: (json['frames'] as List<dynamic>)
          .map((e) => MsrFrame.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$MeasureThreadToJson(MeasureThread instance) =>
    <String, dynamic>{
      'name': instance.name,
      'frames': instance.frames.map((e) => e.toJson()).toList(),
    };

ExceptionUnit _$ExceptionUnitFromJson(Map<String, dynamic> json) =>
    ExceptionUnit(
      type: json['type'] as String?,
      message: json['message'] as String?,
      threadName: json['thread_name'] as String?,
      threadSequence: (json['thread_sequence'] as num?)?.toInt() ?? 0,
      osBuildNumber: json['os_build_number'] as String?,
      frames: (json['frames'] as List<dynamic>)
          .map((e) => MsrFrame.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$ExceptionUnitToJson(ExceptionUnit instance) =>
    <String, dynamic>{
      'type': instance.type,
      'message': instance.message,
      'frames': instance.frames.map((e) => e.toJson()).toList(),
      'thread_name': instance.threadName,
      'thread_sequence': instance.threadSequence,
      'os_build_number': instance.osBuildNumber,
    };

MsrFrame _$MsrFrameFromJson(Map<String, dynamic> json) => MsrFrame(
      className: json['class_name'] as String?,
      methodName: json['method_name'] as String?,
      fileName: json['file_name'] as String?,
      lineNum: (json['line_num'] as num?)?.toInt(),
      moduleName: json['module_name'] as String?,
      colNum: (json['col_num'] as num?)?.toInt(),
      frameIndex: (json['frame_index'] as num?)?.toInt(),
      binaryAddress: json['binary_address'] as String?,
      symbolAddress: json['symbol_address'] as String?,
      instructionAddress: json['instruction_address'] as String?,
      inApp: json['in_app'] as bool? ?? false,
    );

Map<String, dynamic> _$MsrFrameToJson(MsrFrame instance) => <String, dynamic>{
      'class_name': instance.className,
      'method_name': instance.methodName,
      'file_name': instance.fileName,
      'line_num': instance.lineNum,
      'module_name': instance.moduleName,
      'col_num': instance.colNum,
      'frame_index': instance.frameIndex,
      'binary_address': instance.binaryAddress,
      'symbol_address': instance.symbolAddress,
      'instruction_address': instance.instructionAddress,
      'in_app': instance.inApp,
    };

BinaryImage _$BinaryImageFromJson(Map<String, dynamic> json) => BinaryImage(
      baseAddr: json['base_addr'] as String,
      uuid: json['uuid'] as String,
      arch: json['arch'] as String,
    );

Map<String, dynamic> _$BinaryImageToJson(BinaryImage instance) =>
    <String, dynamic>{
      'base_addr': instance.baseAddr,
      'uuid': instance.uuid,
      'arch': instance.arch,
    };
