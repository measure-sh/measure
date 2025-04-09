package sh.measure.flutter

object MethodConstants {
    // Function names
    const val FUNCTION_TRACK_CUSTOM_EVENT = "trackCustomEvent"
    const val FUNCTION_TRACK_EXCEPTION = "trackException"
    const val FUNCTION_NATIVE_CRASH = "triggerNativeCrash"

    // Argument keys
    const val ARG_NAME = "name"
    const val ARG_TIMESTAMP = "timestamp"
    const val ARG_ATTRIBUTES = "attributes"
    const val ARG_SERIALIZED_EXCEPTION = "serialized_exception"


    // Exception object
    const val EXCEPTION_EXCEPTIONS = "exceptions"
    const val EXCEPTION_HANDLED = "handled"
    const val EXCEPTION_TYPE = "type"
    const val EXCEPTION_MESSAGE = "message"
    const val EXCEPTION_FRAMES = "frames"
    const val EXCEPTION_FRAME_CLASS_NAME = "class_name"
    const val EXCEPTION_FRAME_METHOD_NAME = "method_name"
    const val EXCEPTION_FRAME_FILE_NAME = "file_name"
    const val EXCEPTION_FRAME_LINE_NUM = "line_num"
    const val EXCEPTION_FRAME_MODULE_NAME = "module_name"
    const val EXCEPTION_FRAME_COL_NUM = "col_num"
    const val EXCEPTION_FRAME_INDEX = "index"
    const val EXCEPTION_FRAME_BINARY_ADDR = "binary_addr"
    const val EXCEPTION_FRAME_INSTRUCTION_ADDR = "instruction_addr"

    // Error codes
    const val ERROR_INVALID_ARGUMENT = "invalid_argument"
    const val ERROR_ARGUMENT_MISSING = "argument_missing"
    const val ERROR_INVALID_ATTRIBUTE = "invalid_attribute"
    const val ERROR_UNKNOWN = "unknown_error"
}
