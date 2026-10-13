package sh.measure.android.nativecrash

/**
 * The parts of an OS tombstone needed to report a native crash.
 */
internal data class Tombstone(
    val arch: String,
    val pid: Int,
    val tid: Int,
    val signal: TombstoneSignal?,
    val abortMessage: String?,
    val causes: List<String>,
    val gwpAsanReport: TombstoneGwpAsanReport?,
    val threads: Map<Int, TombstoneThread>,
    val mappings: List<TombstoneMapping>,
)

internal data class TombstoneSignal(
    val name: String,
    val codeName: String,
    val faultAddress: Long?,
)

internal data class TombstoneThread(
    val id: Int,
    val name: String,
    val frames: List<TombstoneFrame>,
)

internal data class TombstoneFrame(
    val relPc: Long,
    val pc: Long,
    val functionName: String?,
    val fileName: String?,
    val buildId: String?,
)

internal data class TombstoneMapping(
    val beginAddress: Long,
    val endAddress: Long,
    val buildId: String?,
)

internal data class TombstoneGwpAsanReport(
    val type: Int,
    val allocationTid: Long,
    val allocationFrames: List<TombstoneFrame>,
    val deallocationTid: Long,
    val deallocationFrames: List<TombstoneFrame>,
)
