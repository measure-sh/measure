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
     * The severity of the exception.
     */
    val severity: ExceptionSeverity? = null,

    /**
     * Whether the app was in the foreground or not when the exception occurred.
     */
    val foreground: Boolean,

    /**
     * Marks this exception as a custom error.
     */
    val is_custom: Boolean? = null,

    /**
     * A numeric code that describes the exception.
     */
    val num_code: Long? = null,

    /**
     * A string code that describes the exception.
     */
    val code: String? = null,

    /**
     * Arbitrary key-value metadata associated with the exception.
     */
    val meta: Map<String, String>? = null,

    /**
     * The list of binary images loaded in the process.
     */
    val binary_images: List<BinaryImage> = listOf(),

    /**
     * The framework in which the exception occurred.
     * For Android this is always JVM.
     */
    val framework: String? = ExceptionFramework.JVM,

    /**
     * The ART thread dump the system captured for an ANR, trimmed to its
     * thread blocks. Set only for ANRs reported from app exit info.
     */
    val art_thread_dump: String? = null,

    /**
     * The system reported cause of an ANR, naming the deadline that
     * expired. Set only for ANRs reported from app exit info.
     */
    val subject: String? = null,

    /**
     * The message passed to abort by the native code that crashed.
     */
    val abort_message: String? = null,

    /**
     * A summary of the likely cause, as reported by the OS.
     */
    val cause: String? = null,

    /**
     * The report GWP-ASan wrote when it caught bad memory use, with where
     * the memory was allocated and freed.
     */
    val gwp_asan_report: GwpAsanReport? = null,
)

@Serializable
internal data class GwpAsanReport(
    /**
     * The kind of error, for example `use_after_free`.
     */
    val type: String,
    /**
     * Where the memory was allocated.
     */
    val allocation: GwpAsanReportStack? = null,
    /**
     * Where the memory was freed.
     */
    val deallocation: GwpAsanReportStack? = null,
)

@Serializable
internal data class GwpAsanReportStack(
    val thread_id: Long,
    /**
     * The name of the thread, or null when it had exited by the time of the crash.
     */
    val thread_name: String? = null,
    val frames: List<Frame>,
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
     * The name of the binary that contains the frame.
     */
    val binary_name: String? = null,

    /**
     * The index of the frame in the stacktrace.
     */
    val frame_index: Int? = null,

    /**
     * `true` if the frame originates from the app module
     */
    val in_app: Boolean = false,
)

/**
 * Represents a binary image. Used for Dart exceptions and native crashes.
 */
@Serializable
internal data class BinaryImage(
    /**
     * The unique identifier of the binary image.
     * This is the `build_id` for Dart exceptions.
     */
    val uuid: String,
    /**
     * The architecture of the platform where the crash occured.
     */
    val arch: String,
    /**
     * The base address of the binary image for Dart exceptions.
     */
    val base_addr: String,
    /**
     * The file name of the binary.
     */
    val name: String? = null,
    /**
     * The path the binary was loaded from.
     */
    val path: String? = null,
    /**
     * The address where the binary's mapping starts.
     */
    val start_addr: String? = null,
    /**
     * The address where the binary's mapping ends.
     */
    val end_addr: String? = null,
    /**
     * `true` if the binary ships with the OS.
     */
    val system: Boolean = false,
)
