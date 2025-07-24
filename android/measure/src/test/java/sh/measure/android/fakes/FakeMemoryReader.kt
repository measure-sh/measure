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
    override fun maxHeapSize(): Long = maxHeapSize

    override fun totalHeapSize(): Long = totalHeapSize

    override fun freeHeapSize(): Long = freeHeapSize

    override fun totalPss(): Int = totalPss

    override fun rss(): Long = rss

    override fun nativeTotalHeapSize(): Long = nativeTotalHeapSize

    override fun nativeFreeHeapSize(): Long = nativeFreeHeapSize
}
