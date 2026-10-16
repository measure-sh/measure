package sh.measure.android.nativecrash

import sh.measure.android.exceptions.BinaryImage
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.ExceptionFramework
import sh.measure.android.exceptions.ExceptionSeverity
import sh.measure.android.exceptions.ExceptionUnit
import sh.measure.android.exceptions.Frame
import sh.measure.android.exceptions.GwpAsanReport
import sh.measure.android.exceptions.GwpAsanReportStack
import sh.measure.android.exceptions.MeasureThread

/**
 * Builds the exception for a native crash from its tombstone.
 */
internal object NativeCrashFactory {
    private const val MAIN_THREAD_NAME = "main"
    private const val APP_INSTALL_PREFIX = "/data/app/"
    private val SYSTEM_PATH_PREFIXES = listOf("/system/", "/apex/", "/vendor/", "/product/")

    // The dashboard marks GWP-ASan crashes on its own.
    private const val GWP_ASAN_CAUSE_PREFIX = "[GWP-ASan]: "
    private val GWP_ASAN_REPORT_TYPES = mapOf(
        1 to "use_after_free",
        2 to "double_free",
        3 to "invalid_free",
        4 to "buffer_overflow",
        5 to "buffer_underflow",
    )

    fun create(tombstone: Tombstone, foreground: Boolean, packageName: String): ExceptionData {
        val crashedThread = tombstone.threads.getValue(tombstone.tid)
        val signal = tombstone.signal
        val otherThreads = tombstone.threads.values
            .filter { it.id != tombstone.tid }
            .sortedBy { it.id }
        val threadFrames = crashedThread.frames + otherThreads.flatMap { it.frames }
        val paths = libraryPaths(threadFrames)
        val gwpAsanReport = tombstone.gwpAsanReport
        val gwpAsanReportFrames = gwpAsanReport?.let { it.allocationFrames + it.deallocationFrames }.orEmpty()

        return ExceptionData(
            exceptions = listOf(
                ExceptionUnit(
                    type = signal?.name,
                    message = signal?.let { message(it) },
                    frames = toFrames(crashedThread.frames, paths, packageName),
                    thread_name = threadName(tombstone, crashedThread),
                ),
            ),
            threads = otherThreads.map { MeasureThread(name = threadName(tombstone, it), frames = toFrames(it.frames, paths, packageName)) },
            severity = ExceptionSeverity.Fatal,
            foreground = foreground,
            binary_images = binaryImages(tombstone, threadFrames + gwpAsanReportFrames, paths),
            framework = ExceptionFramework.NDK,
            abort_message = tombstone.abortMessage,
            cause = tombstone.causes.firstOrNull()?.removePrefix(GWP_ASAN_CAUSE_PREFIX),
            gwp_asan_report = gwpAsanReport?.let { toGwpAsanReport(tombstone, it, paths, packageName) },
        )
    }

    private fun toGwpAsanReport(tombstone: Tombstone, report: TombstoneGwpAsanReport, paths: Map<String, String>, packageName: String): GwpAsanReport? {
        val type = GWP_ASAN_REPORT_TYPES[report.type] ?: return null
        return GwpAsanReport(
            type = type,
            allocation = toGwpAsanReportStack(tombstone, report.allocationTid, report.allocationFrames, paths, packageName),
            deallocation = toGwpAsanReportStack(tombstone, report.deallocationTid, report.deallocationFrames, paths, packageName),
        )
    }

    /**
     * The OS ends these stacks with an unknown frame at address 0.
     */
    private fun toGwpAsanReportStack(tombstone: Tombstone, threadId: Long, frames: List<TombstoneFrame>, paths: Map<String, String>, packageName: String): GwpAsanReportStack? {
        val known = frames.filter { it.pc != 0L }
        if (known.isEmpty()) {
            return null
        }
        return GwpAsanReportStack(
            thread_id = threadId,
            thread_name = tombstone.threads[threadId.toInt()]?.let { threadName(tombstone, it) },
            frames = toFrames(known, paths, packageName),
        )
    }

    /**
     * GWP-ASan report stacks name a library loaded from the APK by the APK alone,
     * so its name comes from the thread frames with the same build ID.
     */
    private fun libraryPaths(frames: List<TombstoneFrame>): Map<String, String> = frames
        .filter { it.buildId != null && it.fileName != null }
        .groupBy({ it.buildId!! }, { it.fileName!! })
        .mapValues { (_, names) -> names.firstOrNull { it.contains('!') } ?: names.first() }

    /**
     * The OS names the main thread after the process, so it is named by its ID.
     */
    private fun threadName(tombstone: Tombstone, thread: TombstoneThread): String = if (thread.id == tombstone.pid) MAIN_THREAD_NAME else thread.name

    private fun message(signal: TombstoneSignal): String {
        val faultAddress = signal.faultAddress ?: return signal.codeName
        return "${signal.codeName} at ${hex(faultAddress)}"
    }

    private fun toFrames(frames: List<TombstoneFrame>, paths: Map<String, String>, packageName: String): List<Frame> = frames.mapIndexed { index, frame ->
        val path = path(frame, paths)
        Frame(
            method_name = frame.functionName,
            instruction_address = hex(frame.pc),
            binary_address = hex(frame.pc - frame.relPc),
            binary_name = path?.let { binaryName(it) },
            frame_index = index,
            in_app = path != null && isAppLibrary(path, packageName),
        )
    }

    private fun path(frame: TombstoneFrame, paths: Map<String, String>): String? = frame.buildId?.let { paths[it] } ?: frame.fileName

    private fun binaryImages(tombstone: Tombstone, frames: List<TombstoneFrame>, paths: Map<String, String>): List<BinaryImage> = frames
        .filter { it.buildId != null && it.fileName != null }
        .distinctBy { it.buildId }
        .map { frame ->
            val path = path(frame, paths)!!
            val baseAddress = frame.pc - frame.relPc
            val mappings = tombstone.mappings.filter { it.buildId == frame.buildId }
            BinaryImage(
                uuid = frame.buildId!!.lowercase(),
                arch = tombstone.arch,
                base_addr = hex(baseAddress),
                name = binaryName(path),
                path = path,
                start_addr = hex(mappings.minOfOrNull { it.beginAddress } ?: baseAddress),
                end_addr = mappings.maxOfOrNull { it.endAddress }?.let { hex(it) },
                system = isSystemPath(path),
            )
        }

    /**
     * Libraries loaded straight from the APK are reported as base.apk!libfoo.so,
     * and anonymous mappings as [anon:...!classes.dex].
     */
    private fun binaryName(path: String): String = path.substringAfterLast('!').substringAfterLast('/').removeSuffix("]")

    /**
     * Other packages, such as an updated WebView, are installed under /data/app too.
     * The install folder is matched by package name because an app update between
     * the crash and its collection moves it.
     */
    private fun isAppLibrary(path: String, packageName: String): Boolean = path.startsWith(APP_INSTALL_PREFIX) &&
        path.contains("/$packageName-") &&
        binaryName(path).endsWith(".so")

    private fun isSystemPath(path: String): Boolean = SYSTEM_PATH_PREFIXES.any { path.startsWith(it) }

    private fun hex(value: Long): String = "0x" + java.lang.Long.toHexString(value)
}
