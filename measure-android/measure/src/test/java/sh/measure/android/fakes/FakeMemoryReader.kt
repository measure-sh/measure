package sh.measure.android.fakes

import sh.measure.android.performance.MemoryReader

internal class FakeMemoryReader(
    private val maxHeapSize: Long = 500,
    private val totalHeapSize: Long = 200,
    private val freeHeapSize: Long = 300,
    private val totalPss: Int = 400,
    private val rss: Long = 1000,
    private val nativeTotalHeapSize: Long = 600,
    private val nativeFreeHeapSize: Long = 250,
) : MemoryReader {
    override fun maxHeapSize(): Long {
        return maxHeapSize
    }

    override fun totalHeapSize(): Long {
        return totalHeapSize
    }

    override fun freeHeapSize(): Long {
        return freeHeapSize
    }

    override fun totalPss(): Int {
        return totalPss
    }

    override fun rss(): Long {
        return rss
    }

    override fun nativeTotalHeapSize(): Long {
        return nativeTotalHeapSize
    }

    override fun nativeFreeHeapSize(): Long {
        return nativeFreeHeapSize
    }
}
