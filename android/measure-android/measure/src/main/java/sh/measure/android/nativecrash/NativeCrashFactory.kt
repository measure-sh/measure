package sh.measure.android.nativecrash

import sh.measure.android.exceptions.BinaryImage
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.ExceptionFramework
import sh.measure.android.exceptions.ExceptionSeverity
import sh.measure.android.exceptions.ExceptionUnit
import sh.measure.android.exceptions.Frame
import sh.measure.android.exceptions.MAX_THREADS_IN_EXCEPTION
import sh.measure.android.exceptions.MeasureThread
import sh.measure.android.exceptions.MemoryError
import sh.measure.android.exceptions.MemoryErrorStack

/**
 * Builds the exception for a native crash from its tombstone.
 */
internal class NativeCrashFactory(private val packageName: String) {
    private companion object {
        const val MAIN_THREAD_NAME = "main"
        const val APP_INSTALL_PREFIX = "/data/app/"
        const val MAX_FRAMES_IN_STACK = 64
        val SYSTEM_PATH_PREFIXES = listOf("/system/", "/apex/", "/vendor/", "/product/")

        // The dashboard shows which tool caught a memory error on its own.
        val MEMORY_ERROR_CAUSE_PREFIXES = listOf("[GWP-ASan]: ", "[MTE]: ")
    }

    /**
     * A recoverable error did not crash the app, so it is reported as unhandled.
     */
    fun create(tombstone: Tombstone, foreground: Boolean, recoverable: Boolean = false): ExceptionData {
        val crashedThread = tombstone.threads.getValue(tombstone.tid)
        val signal = tombstone.signal
        val otherThreads = tombstone.threads.values
            .filter { it.id != tombstone.tid }
            .sortedBy { it.id }
            .take(MAX_THREADS_IN_EXCEPTION)
        val paths = libraryPaths(tombstone.threads.values.flatMap { it.frames })
        val crashedThreadFrames = trim(crashedThread.frames)
        val otherThreadFrames = otherThreads.map { trim(it.frames) }
        val memoryError = tombstone.memoryError
        val memoryErrorFrames = memoryError?.let { memoryErrorStackFrames(it.allocationFrames) + memoryErrorStackFrames(it.deallocationFrames) }.orEmpty()
        val keptFrames = crashedThreadFrames + otherThreadFrames.flatten() + memoryErrorFrames

        return ExceptionData(
            exceptions = listOf(
                ExceptionUnit(
                    type = signal.name,
                    message = message(signal),
                    frames = toFrames(crashedThreadFrames, paths),
                    thread_name = threadName(tombstone, crashedThread),
                ),
            ),
            threads = otherThreads.zip(otherThreadFrames) { thread, frames ->
                MeasureThread(name = threadName(tombstone, thread), frames = toFrames(frames, paths))
            },
            severity = if (recoverable) ExceptionSeverity.Unhandled else ExceptionSeverity.Fatal,
            foreground = foreground,
            binary_images = binaryImages(tombstone, keptFrames, paths),
            framework = ExceptionFramework.NDK,
            abort_message = tombstone.abortMessage,
            cause = tombstone.causes.firstOrNull()?.let { removeMemoryErrorPrefix(it) },
            memory_error = memoryError?.let { toMemoryError(tombstone, it, paths) },
        )
    }

    private fun removeMemoryErrorPrefix(cause: String): String {
        val prefix = MEMORY_ERROR_CAUSE_PREFIXES.firstOrNull { cause.startsWith(it) } ?: return cause
        return cause.removePrefix(prefix)
    }

    private fun toMemoryError(tombstone: Tombstone, error: TombstoneMemoryError, paths: Map<String, String>): MemoryError = MemoryError(
        tool = error.tool,
        type = error.type,
        address = error.address?.let { hex(it) },
        size = error.size,
        allocation = toMemoryErrorStack(tombstone, error.allocationTid, error.allocationFrames, paths),
        deallocation = toMemoryErrorStack(tombstone, error.deallocationTid, error.deallocationFrames, paths),
    )

    private fun toMemoryErrorStack(tombstone: Tombstone, threadId: Int?, frames: List<TombstoneFrame>, paths: Map<String, String>): MemoryErrorStack? {
        val known = memoryErrorStackFrames(frames)
        if (threadId == null || known.isEmpty()) {
            return null
        }
        return MemoryErrorStack(
            thread_id = threadId.toLong(),
            thread_name = tombstone.threads[threadId]?.let { threadName(tombstone, it) },
            frames = toFrames(known, paths),
        )
    }

    /**
     * The OS ends these stacks with an unknown frame at address 0.
     */
    private fun memoryErrorStackFrames(frames: List<TombstoneFrame>): List<TombstoneFrame> = trim(frames.filter { it.pc != 0L })

    /**
     * Keeps the first and last frames of a deep stack. The first frames show where
     * the thread crashed, and the last frames show how it started.
     */
    private fun trim(frames: List<TombstoneFrame>): List<TombstoneFrame> {
        if (frames.size <= MAX_FRAMES_IN_STACK) {
            return frames
        }
        val half = MAX_FRAMES_IN_STACK / 2
        return frames.take(half) + frames.takeLast(half)
    }

    /**
     * Memory error stacks name a library loaded from the APK by the APK alone,
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

    private fun toFrames(frames: List<TombstoneFrame>, paths: Map<String, String>): List<Frame> = frames.mapIndexed { index, frame ->
        val path = path(frame, paths)
        Frame(
            method_name = frame.functionName,
            instruction_address = hex(frame.pc),
            binary_address = hex(frame.pc - frame.relPc),
            binary_name = path?.let { binaryName(it) },
            frame_index = index,
            in_app = path != null && isAppLibrary(path),
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
    private fun isAppLibrary(path: String): Boolean = path.startsWith(APP_INSTALL_PREFIX) &&
        path.contains("/$packageName-") &&
        binaryName(path).endsWith(".so")

    private fun isSystemPath(path: String): Boolean = SYSTEM_PATH_PREFIXES.any { path.startsWith(it) }

    private fun hex(value: Long): String = "0x" + java.lang.Long.toHexString(value)
}
