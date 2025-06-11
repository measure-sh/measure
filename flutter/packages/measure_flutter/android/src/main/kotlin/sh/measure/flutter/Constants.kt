package sh.measure.flutter

object MethodConstants {
    // functions
    const val FUNCTION_TRACK_EVENT = "trackEvent"
    const val FUNCTION_TRACK_SPAN = "trackSpan"
    const val FUNCTION_TRIGGER_NATIVE_CRASH = "triggerNativeCrash"
    const val FUNCTION_INITIALIZE_NATIVE_SDK = "initializeNativeSDK"

    // arguments
    const val ARG_EVENT_DATA = "event_data"
    const val ARG_EVENT_TYPE = "event_type"
    const val ARG_SPAN_DATA = "span_data"
    const val ARG_TIMESTAMP = "timestamp"
    const val ARG_USER_DEFINED_ATTRS = "user_defined_attrs"
    const val ARG_USER_TRIGGERED = "user_triggered"
    const val ARG_THREAD_NAME = "thread_name"
    const val ARG_CONFIG = "config"
    const val ARG_CLIENT_INFO = "client_info"
}

object ErrorCode {
    const val ERROR_INVALID_ARGUMENT = "invalid_argument"
    const val ERROR_ARGUMENT_MISSING = "argument_missing"
    const val ERROR_INVALID_ATTRIBUTE = "invalid_attribute"
    const val ERROR_UNKNOWN = "unknown_error"
}
