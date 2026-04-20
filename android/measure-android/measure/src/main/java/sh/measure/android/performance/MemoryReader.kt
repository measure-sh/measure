package sh.measure.android.performance

import android.os.Debug
import android.system.OsConstants
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.DebugProvider
import sh.measure.android.utils.OsSysConfProvider
import sh.measure.android.utils.ProcProvider
import sh.measure.android.utils.ProcessInfoProvider
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
     * Returns the Resident Set Size (RSS) of the process, in KB.
     */
    fun rss(): Long?

    /**
     * Returns the total size of the native heap, in KB.
     */
    fun nativeTotalHeapSize(): Long

    /**
     * Returns the amount of free memory in the native heap, in KB.
     */
    fun nativeFreeHeapSize(): Long
}

internal class DefaultMemoryReader(
    private val logger: Logger,
    private val debugProvider: DebugProvider,
    private val runtimeProvider: RuntimeProvider,
    private val processInfo: ProcessInfoProvider,
    private val procProvider: ProcProvider,
    private val osSysConfProvider: OsSysConfProvider,
) : MemoryReader {
    override fun maxHeapSize() = runtimeProvider.maxMemory() / BYTES_TO_KB_FACTOR

    override fun totalHeapSize() = runtimeProvider.totalMemory() / BYTES_TO_KB_FACTOR

    override fun freeHeapSize() = runtimeProvider.freeMemory() / BYTES_TO_KB_FACTOR

    private val pageSize by lazy(LazyThreadSafetyMode.NONE) {
        // https://developer.android.com/guide/practices/page-sizes#check-code
        osSysConfProvider.get(OsConstants._SC_PAGESIZE) / BYTES_TO_KB_FACTOR
    }

    override fun totalPss(): Int {
        val memoryInfo = Debug.MemoryInfo()
        debugProvider.populateMemoryInfo(memoryInfo)
        return memoryInfo.totalPss
    }

    override fun rss(): Long? {
        val pid = processInfo.getPid()
        val file = procProvider.getStatmFile(pid)
        if (file.exists()) {
            try {
                val pages = file.readText().split(" ")[1].toLong()
                return pages * pageSize
            } catch (e: Exception) {
                logger.log(LogLevel.Debug, "Failed to read RSS file from /proc/pid/statm", e)
            }
        }
        return null
    }

    override fun nativeTotalHeapSize() = debugProvider.getNativeHeapSize() / BYTES_TO_KB_FACTOR

    override fun nativeFreeHeapSize() = debugProvider.getNativeHeapFreeSize() / BYTES_TO_KB_FACTOR
}
