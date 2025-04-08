package sh.measure.flutter

object MethodConstants {
    const val FUNCTION_TRACK_CUSTOM_EVENT = "trackCustomEvent"
    const val FUNCTION_TRACK_EXCEPTION = "trackException"
    const val FUNCTION_NATIVE_CRASH = "triggerNativeCrash"

    const val ARG_NAME = "name"
    const val ARG_TIMESTAMP = "timestamp"
    const val ARG_ATTRIBUTES = "attributes"
    const val ARG_EXCEPTION_DATA = "exception_data"
    const val ARG_EXCEPTION_DATA_EXCEPTIONS = "exceptions";
    const val ARG_EXCEPTION_DATA_HANDLED = "handled";
    const val ARG_EXCEPTION_DATA_UNIT_TYPE = "type";
    const val ARG_EXCEPTION_DATA_UNIT_MESSAGE = "message";
    const val ARG_EXCEPTION_DATA_UNIT_FRAMES = "frames";
    const val ARG_EXCEPTION_DATA_FRAME_CLASS_NAME = "class_name";
    const val ARG_EXCEPTION_DATA_FRAME_METHOD_NAME = "method_name";
    const val ARG_EXCEPTION_DATA_FRAME_FILE_NAME = "file_name";
    const val ARG_EXCEPTION_DATA_FRAME_LINE_NUM = "line_num";
    const val ARG_EXCEPTION_DATA_FRAME_MODULE_NAME = "module_name";
    const val ARG_EXCEPTION_DATA_FRAME_COL_NUM = "col_num";
    const val ARG_EXCEPTION_DATA_FRAME_INDEX = "index";
    const val ARG_EXCEPTION_DATA_FRAME_BINARY_ADDR = "binary_addr";
    const val ARG_EXCEPTION_DATA_FRAME_INSTRUCTION_ADDR = "instruction_addr";

    const val ERROR_INVALID_ARGUMENT = "invalid_argument"
    const val ERROR_ARGUMENT_MISSING = "argument_missing"
    const val ERROR_INVALID_ATTRIBUTE = "invalid_attribute"
    const val ERROR_UNKNOWN = "unknown_error"
}
