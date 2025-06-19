class MethodConstants {
  // Function names
  static const String functionTrackEvent = 'trackEvent';
  static const String functionTriggerNativeCrash = 'triggerNativeCrash';
  static const String functionInitializeNativeSDK = 'initializeNativeSDK';
  static const String functionStart = 'start';
  static const String functionStop = 'stop';

  // Argument keys
  static const String argEventData = 'event_data';
  static const String argEventType = 'event_type';
  static const String argTimestamp = 'timestamp';
  static const String argUserDefinedAttrs = 'user_defined_attrs';
  static const String argUserTriggered = 'user_triggered';
  static const String argThreadName = 'thread_name';
  static const String argConfig = 'config';
  static const String argClientInfo = 'client_info';

  // Error codes
  static const String errorInvalidArgument = 'invalid_argument';
  static const String errorArgumentMissing = 'argument_missing';
  static const String errorInvalidAttribute = 'invalid_attribute';
  static const String errorUnknown = 'unknown_error';
}
