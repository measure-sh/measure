package sh.measure.android.nativecrash

/**
 * The parts of an OS tombstone needed to report a native crash.
 */
internal data class Tombstone(
    /**
     * The CPU architecture of the process, such as `arm64`.
     */
    val arch: String,
    /**
     * The ID of the process that crashed.
     */
    val pid: Int,
    /**
     * The ID of the thread that crashed.
     */
    val tid: Int,
    /**
     * The signal that ended the process.
     */
    val signal: TombstoneSignal,
    /**
     * The message passed to abort, or null if none was set.
     */
    val abortMessage: String?,
    /**
     * The likely causes of the crash, such as "null pointer dereference".
     */
    val causes: List<String>,
    /**
     * The memory error that GWP-ASan or MTE caught, or null if neither caught the crash.
     */
    val memoryError: TombstoneMemoryError?,
    /**
     * The threads of the process, keyed by thread ID.
     */
    val threads: Map<Int, TombstoneThread>,
    /**
     * The memory mappings of the process.
     */
    val mappings: List<TombstoneMapping>,
)

internal data class TombstoneSignal(
    /**
     * The signal name, such as `SIGSEGV`.
     */
    val name: String,
    /**
     * The signal code, such as `SEGV_MAPERR`.
     */
    val codeName: String,
    /**
     * The memory address that caused the signal, or null if the signal has none.
     */
    val faultAddress: Long?,
)

internal data class TombstoneThread(
    /**
     * The thread ID.
     */
    val id: Int,
    /**
     * The thread name.
     */
    val name: String,
    /**
     * The stack frames of the thread, starting with the innermost frame.
     */
    val frames: List<TombstoneFrame>,
)

internal data class TombstoneFrame(
    /**
     * The frame's address relative to the start of its library.
     */
    val relPc: Long,
    /**
     * The frame's absolute address in memory.
     */
    val pc: Long,
    /**
     * The function name, or null if it is not known.
     */
    val functionName: String?,
    /**
     * The path of the library that contains the frame, or null if it is not known.
     */
    val fileName: String?,
    /**
     * The build ID of the library that contains the frame, or null if it is not known.
     */
    val buildId: String?,
)

internal data class TombstoneMapping(
    /**
     * The address where the mapping starts.
     */
    val beginAddress: Long,
    /**
     * The address where the mapping ends.
     */
    val endAddress: Long,
    /**
     * The build ID of the mapped library, or null if it has none.
     */
    val buildId: String?,
)

internal data class TombstoneMemoryError(
    /**
     * The tool that caught the memory error, either `gwp_asan` or `mte`.
     */
    val tool: String,
    /**
     * The kind of memory bug, such as `use_after_free`, or `unknown`.
     */
    val type: String,
    /**
     * The address of the allocation, or null if it is not known.
     */
    val address: Long?,
    /**
     * The size of the allocation in bytes, or null if it is not known.
     */
    val size: Long?,
    /**
     * The ID of the thread that allocated the memory, or null if it is not known.
     */
    val allocationTid: Int?,
    /**
     * The stack frames where the memory was allocated.
     */
    val allocationFrames: List<TombstoneFrame>,
    /**
     * The ID of the thread that freed the memory, or null if it is not known.
     */
    val deallocationTid: Int?,
    /**
     * The stack frames where the memory was freed.
     */
    val deallocationFrames: List<TombstoneFrame>,
)
