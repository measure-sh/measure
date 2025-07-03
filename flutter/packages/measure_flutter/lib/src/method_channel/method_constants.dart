class MethodConstants {
  // Function names
  static const String functionTrackEvent = 'trackEvent';
  static const String functionTriggerNativeCrash = 'triggerNativeCrash';
  static const String functionInitializeNativeSDK = 'initializeNativeSDK';
  static const String functionStart = 'start';
  static const String functionStop = 'stop';
  static const String functionGetSessionId = 'getSessionId';
  static const String functionTrackSpan = 'trackSpan';
  static const String functionSetUserId = 'setUserId';
  static const String functionClearUserId = 'clearUserId';
  static const String functionGetAttachmentDirectory = 'getAttachmentDirectory';
  static const String functionEnableShakeDetector = 'enableShakeDetector';
  static const String functionDisableShakeDetector = 'disableShakeDetector';

  // Argument keys
  static const String argEventData = 'event_data';
  static const String argEventType = 'event_type';
  static const String argTimestamp = 'timestamp';
  static const String argUserDefinedAttrs = 'user_defined_attrs';
  static const String argUserTriggered = 'user_triggered';
  static const String argThreadName = 'thread_name';
  static const String argAttachments = 'attachments';
  static const String argConfig = 'config';
  static const String argClientInfo = 'client_info';
  static const String argSpanName = "name";
  static const String argSpanTraceId = "traceId";
  static const String argSpanSpanId = "id";
  static const String argSpanParentId = "parentId";
  static const String argSpanStartTime = "startTime";
  static const String argSpanEndTime = "endTime";
  static const String argSpanDuration = "duration";
  static const String argSpanStatus = "status";
  static const String argSpanAttributes = "attributes";
  static const String argSpanUserDefinedAttrs = "userDefinedAttrs";
  static const String argSpanCheckpoints = "checkpoints";
  static const String argSpanCheckpointName = "name";
  static const String argSpanCheckpointTimestamp = "timestamp";
  static const String argSpanHasEnded = "hasEnded";
  static const String argSpanIsSampled = "isSampled";
  static const String argUserId = 'user_id';

  // Error codes
  static const String errorInvalidArgument = 'invalid_argument';
  static const String errorArgumentMissing = 'argument_missing';
  static const String errorInvalidAttribute = 'invalid_attribute';
  static const String errorUnknown = 'unknown_error';

  // Callbacks
  static const String callbackOnShakeDetected = 'onShakeDetected';
}
