class MethodConstants {
  // Function names
  static const String functionTrackCustomEvent = 'trackCustomEvent';
  static const String functionTriggerNativeCrash = 'triggerNativeCrash';
  static const String functionTrackException = 'trackException';

  // Argument keys
  static const String argName = 'name';
  static const String argTimestamp = 'timestamp';
  static const String argAttributes = 'attributes';
  static const String argSerializedException = 'serialized_exception';

  // Exception object
  static const String exceptionExceptions = 'exceptions';
  static const String exceptionHandled = 'handled';
  static const String exceptionType = 'type';
  static const String exceptionMessage = 'message';
  static const String exceptionFrames = 'frames';
  static const String exceptionFrameClassName = 'class_name';
  static const String exceptionFrameMethodName = 'method_name';
  static const String exceptionFrameFileName = 'file_name';
  static const String exceptionFrameLineNum = 'line_num';
  static const String exceptionFrameModuleName = 'module_name';
  static const String exceptionFrameColNum = 'col_num';
  static const String exceptionFrameIndex = 'index';
  static const String exceptionFrameBinaryAddress = 'binary_address';
  static const String exceptionFrameInstructionAddress = 'instruction_address';

  // Error codes
  static const String errorInvalidArgument = 'invalid_argument';
  static const String errorArgumentMissing = 'argument_missing';
  static const String errorInvalidAttribute = 'invalid_attribute';
  static const String errorUnknown = 'unknown_error';
}
