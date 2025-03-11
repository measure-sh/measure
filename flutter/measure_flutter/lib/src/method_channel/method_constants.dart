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
  static const String argExceptionDataFrameClassName = 'className';
  static const String argExceptionDataFrameMethodName = 'methodName';
  static const String argExceptionDataFrameFileName = 'fileName';
  static const String argExceptionDataFrameLineNum = 'lineNum';
  static const String argExceptionDataFrameModuleName = 'moduleName';
  static const String argExceptionDataFrameColNum = 'colNum';
  static const String argExceptionDataFrameIndex = 'index';
  static const String argExceptionDataFrameBinaryAddr = 'binaryAddr';
  static const String argExceptionDataFrameInstructionAddress = 'instructionAddr';

  // Error codes
  static const String argExceptionDataFrame = 'frameIndex';
  static const String errorInvalidArgument = 'invalid_argument';
  static const String errorArgumentMissing = 'argument_missing';
  static const String errorInvalidAttribute = 'invalid_attribute';
  static const String errorUnknown = 'unknown_error';
}
