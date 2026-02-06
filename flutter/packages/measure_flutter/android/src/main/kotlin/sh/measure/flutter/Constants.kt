package sh.measure.flutter

object MethodConstants {
    // functions
    const val FUNCTION_TRACK_EVENT = "trackEvent"
    const val FUNCTION_TRIGGER_NATIVE_CRASH = "triggerNativeCrash"
    const val FUNCTION_GET_SESSION_ID = "getSessionId"
    const val FUNCTION_TRACK_SPAN = "trackSpan"
    const val FUNCTION_START = "start"
    const val FUNCTION_STOP = "stop"
    const val FUNCTION_SET_USER_ID = "setUserId"
    const val FUNCTION_CLEAR_USER_ID = "clearUserId"
    const val FUNCTION_GET_ATTACHMENT_DIRECTORY = "getAttachmentDirectory"
    const val FUNCTION_ENABLE_SHAKE_DETECTOR = "enableShakeDetector"
    const val FUNCTION_DISABLE_SHAKE_DETECTOR = "disableShakeDetector"
    const val FUNCTION_GET_DYNAMIC_CONFIG_PATH = "getDynamicConfigPath"

    // arguments
    const val ARG_EVENT_DATA = "event_data"
    const val ARG_EVENT_TYPE = "event_type"
    const val ARG_TIMESTAMP = "timestamp"
    const val ARG_USER_DEFINED_ATTRS = "user_defined_attrs"
    const val ARG_USER_TRIGGERED = "user_triggered"
    const val ARG_THREAD_NAME = "thread_name"
    const val ARG_ATTACHMENTS = "attachments"
    const val ARG_CONFIG = "config"
    const val ARG_CLIENT_INFO = "client_info"
    const val ARG_SPAN_NAME = "name";
    const val ARG_SPAN_TRACE_ID = "traceId";
    const val ARG_SPAN_SPAN_ID = "id";
    const val ARG_SPAN_PARENT_ID = "parentId";
    const val ARG_SPAN_START_TIME = "startTime";
    const val ARG_SPAN_END_TIME = "endTime";
    const val ARG_SPAN_DURATION = "duration";
    const val ARG_SPAN_STATUS = "status";
    const val ARG_SPAN_ATTRIBUTES = "attributes";
    const val ARG_SPAN_USER_DEFINED_ATTRS = "userDefinedAttrs";
    const val ARG_SPAN_CHECKPOINTS = "checkpoints";
    const val ARG_SPAN_HAS_ENDED = "hasEnded";
    const val ARG_SPAN_IS_SAMPLED = "isSampled";
    const val ARG_USER_ID = "user_id";

    // Callbacks
    const val CALLBACK_ON_SHAKE_DETECTED = "onShakeDetected"
}

object ErrorCode {
    const val ERROR_INVALID_ARGUMENT = "invalid_argument"
    const val ERROR_ARGUMENT_MISSING = "argument_missing"
    const val ERROR_INVALID_ATTRIBUTE = "invalid_attribute"
    const val ERROR_UNKNOWN = "unknown_error"
}
