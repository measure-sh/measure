class MethodConstants {
  // Function names
  static const String functionTrackCustomEvent = 'trackCustomEvent';
  static const String functionTriggerNativeCrash = 'triggerNativeCrash';
  static const String functionTrackException = 'trackException';

  // Argument keys
  static const String argName = 'name';
  static const String argTimestamp = 'timestamp';
  static const String argAttributes = 'attributes';

  // Error codes
  static const String argSerializedExceptionData = 'exception_data';
  static const String argExceptionDataExceptions = 'exceptions';
  static const String argExceptionDataHandled = 'handled';
  static const String argExceptionDataUnitType = 'type';
  static const String argExceptionDataUnitMessage = 'message';
  static const String argExceptionDataUnitFrames = 'frames';
  static const String argExceptionDataFrameClassName = 'class_name';
  static const String argExceptionDataFrameMethodName = 'method_name';
  static const String argExceptionDataFrameFileName = 'file_name';
  static const String argExceptionDataFrameLineNum = 'line_num';
  static const String argExceptionDataFrameModuleName = 'module_name';
  static const String argExceptionDataFrameColNum = 'col_num';
  static const String argExceptionDataFrameIndex = 'index';
  static const String argExceptionDataFrameBinaryAddr = 'binary_addr';
  static const String argExceptionDataFrameInstructionAddress = 'instruction_addr';
  static const String argExceptionDataFrame = 'frame_index';

  // Error codes
  static const String errorInvalidArgument = 'invalid_argument';
  static const String errorArgumentMissing = 'argument_missing';
  static const String errorInvalidAttribute = 'invalid_attribute';
  static const String errorUnknown = 'unknown_error';
}
