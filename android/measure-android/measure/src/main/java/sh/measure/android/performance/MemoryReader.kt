package sh.measure.android.performance

import android.os.Debug
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.DebugProvider
import sh.measure.android.utils.ProcProvider
import sh.measure.android.utils.RuntimeProvider

/**
 * A utility clas to read memory information from difference sources such as runtime, debug, and
 * proc.
 */
internal interface MemoryReader {
    /**
     * Returns the maximum amount of memory that the virtual machine will attempt to use, in KB.
     */
    fun maxHeapSize(): Long

    /**
     * Returns the total amount of memory in the Java virtual machine, in KB.
     */
    fun totalHeapSize(): Long

    /**
     * Returns the amount of free memory in the Java Virtual Machine, in KB.
     */
    fun freeHeapSize(): Long

    /**
     * Returns the total PSS (Proportional Set Size) of the process, in KB.
     */
    fun totalPss(): Int

    /**
     * Reads RSS, anonymous RSS, and swap together from /proc/self/status, in KB (1024 bytes).
     */
    fun readProcStatus(): ProcStatusMemory

    /**
     * Returns the total size of the native heap, in KB.
     */
    fun nativeTotalHeapSize(): Long

    /**
     * Returns the amount of free memory in the native heap, in KB.
     */
    fun nativeFreeHeapSize(): Long
}

internal data class ProcStatusMemory(
    val rss: Long? = null,
    val anonRss: Long? = null,
    val swap: Long? = null,
)

internal class DefaultMemoryReader(
    private val logger: Logger,
    private val debugProvider: DebugProvider,
    private val runtimeProvider: RuntimeProvider,
    private val procProvider: ProcProvider,
) : MemoryReader {
    override fun maxHeapSize() = runtimeProvider.maxMemory() / BYTES_TO_KB_FACTOR

    override fun totalHeapSize() = runtimeProvider.totalMemory() / BYTES_TO_KB_FACTOR

    override fun freeHeapSize() = runtimeProvider.freeMemory() / BYTES_TO_KB_FACTOR

    override fun totalPss(): Int {
        val memoryInfo = Debug.MemoryInfo()
        debugProvider.populateMemoryInfo(memoryInfo)
        return memoryInfo.totalPss
    }

    override fun readProcStatus(): ProcStatusMemory = try {
        var rss: Long? = null
        var anonRss: Long? = null
        var swap: Long? = null
        procProvider.getStatusFile().useLines { lines ->
            lines.forEach { line ->
                when (line.substringBefore(':')) {
                    "VmRSS" -> rss = parseStatusMemoryKB(line)
                    "RssAnon" -> anonRss = parseStatusMemoryKB(line)
                    "VmSwap" -> swap = parseStatusMemoryKB(line)
                }
            }
        }
        ProcStatusMemory(rss, anonRss, swap)
    } catch (e: Exception) {
        logger.log(LogLevel.Debug, "Failed to read memory from /proc/self/status", e)
        ProcStatusMemory()
    }

    private fun parseStatusMemoryKB(line: String): Long? {
        // Linux reports these fields in kB, where 1 kB is 1024 bytes.
        val value = line.substringAfter(':').trim()
        if (!value.endsWith("kB")) return null
        return value.removeSuffix("kB").trim().toLongOrNull()?.takeIf { it >= 0 }
    }

    override fun nativeTotalHeapSize() = debugProvider.getNativeHeapSize() / BYTES_TO_KB_FACTOR

    override fun nativeFreeHeapSize() = debugProvider.getNativeHeapFreeSize() / BYTES_TO_KB_FACTOR
}
