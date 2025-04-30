package sh.measure.android.exceptions

import kotlinx.serialization.Serializable

/**
 * Represents an exception in Measure. This is used to track handled and unhandled exceptions.
 */
@Serializable
internal data class ExceptionData(
    /**
     * A list of exceptions that were thrown. Multiple exceptions represent "chained" exceptions.
     */
    val exceptions: List<ExceptionUnit>,

    /**
     * The stacktrace of all the threads at the time of the exception.
     */
    val threads: List<MeasureThread>,

    /**
     * Whether the exception was handled or not.
     */
    val handled: Boolean,

    /**
     * Whether the app was in the foreground or not when the exception occurred.
     */
    val foreground: Boolean,
)

@Serializable
internal data class MeasureThread(
    val name: String,
    val frames: List<Frame>,
)

/**
 * Represents a stacktrace in Measure.
 */
@Serializable
internal data class ExceptionUnit(
    /**
     * The fully qualified type of the exception. For example, java.lang.Exception.
     */
    val type: String?,

    /**
     * A message which describes the exception.
     */
    val message: String? = null,

    /**
     * A list of stack frames for the exception.
     */
    val frames: List<Frame>,

    /**
     * An optional POSIX signal received by the process.
     */
    val signal: String? = null,

    /**
     * The name of the thread.
     */
    val thread_name: String? = null,

    /**
     * The sequence number of the thread.
     */
    val thread_sequence: Int = 0,

    /**
     * The OS System Build unique for the device.
     */
    val os_build_number: String? = null,
)

/**
 * Represents a stackframe in Measure.
 */
@Serializable
internal data class Frame(
    /**
     * The fully qualified class name.
     */
    val class_name: String? = null,

    /**
     * The name of the method in the stacktrace.
     */
    val method_name: String? = null,

    /**
     * The name of the source file in the stacktrace.
     */
    val file_name: String? = null,

    /**
     * The line number of the method called.
     */
    val line_num: Int? = null,

    /**
     * The library or module where the crash occurred.
     */
    val module_name: String? = null,

    /**
     * The column number of the method called.
     */
    val col_num: Int? = null,

    /**
     * The instruction address of the frame.
     */
    val instruction_address: String? = null,

    /**
     * The binary address of the frame.
     */
    val binary_address: String? = null,

    /**
     * The symbol address of the frame.
     */
    val symbol_address: String? = null,

    /**
     * The index of the frame in the stacktrace.
     */
    val frame_index: Int? = null,

    /**
     * `true` if the frame originates from the app module
     */
    val in_app: Boolean = false,
)
