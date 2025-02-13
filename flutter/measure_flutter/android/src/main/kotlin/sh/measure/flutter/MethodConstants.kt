package sh.measure.flutter

object MethodConstants {
    const val FUNCTION_TRACK_CUSTOM_EVENT = "trackCustomEvent"
    const val FUNCTION_TRACK_EXCEPTION = "trackException"
    const val FUNCTION_NATIVE_CRASH = "triggerNativeCrash"

    const val ARG_NAME = "name"
    const val ARG_TIMESTAMP = "timestamp"
    const val ARG_ATTRIBUTES = "attributes"
    const val ARG_EXCEPTION_DATA = "exception_data"

    const val ERROR_INVALID_ARGUMENT = "invalid_argument"
    const val ERROR_ARGUMENT_MISSING = "argument_missing"
    const val ERROR_INVALID_ATTRIBUTE = "invalid_attribute"
    const val ERROR_UNKNOWN = "unknown_error"
}
