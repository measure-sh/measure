package sh.measure.android.performance

import android.os.Debug
import org.junit.Assert
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import sh.measure.android.fakes.FakeDebugProvider
import sh.measure.android.fakes.FakeProcProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.DefaultRuntimeProvider

internal class DefaultMemoryReaderTest {
    private val debugProvider = FakeDebugProvider()
    private val procProvider = FakeProcProvider()

    // Using the real implementation of RuntimeProvider as it is available in tests.
    private val runtimeProvider = DefaultRuntimeProvider()

    private val memoryReader = DefaultMemoryReader(
        logger = NoopLogger(),
        debugProvider = debugProvider,
        runtimeProvider = runtimeProvider,
        procProvider = procProvider,
    )

    @get:Rule
    val tempFolder = TemporaryFolder()

    @Test
    fun `reads max heap size from runtime and returns it in KB`() {
        val actual = runtimeProvider.maxMemory() / BYTES_TO_KB_FACTOR
        val expected = memoryReader.maxHeapSize()
        Assert.assertEquals(expected, actual)
    }

    @Test
    fun `reads total heap size from runtime and returns it in KB`() {
        val actual = runtimeProvider.totalMemory() / BYTES_TO_KB_FACTOR
        val expected = memoryReader.totalHeapSize()
        Assert.assertEquals(expected, actual)
    }

    @Test
    fun `reads free heap size from runtime and returns it in KB`() {
        val actual = runtimeProvider.freeMemory() / BYTES_TO_KB_FACTOR
        val expected = memoryReader.freeHeapSize()
        Assert.assertEquals(expected, actual)
    }

    @Test
    fun `populates MemoryInfo and returns the total PSS`() {
        val memoryInfo = Debug.MemoryInfo().also {
            debugProvider.populateMemoryInfo(it)
        }
        val expected = memoryReader.totalPss()
        Assert.assertEquals(expected, memoryInfo.totalPss)
    }

    @Test
    fun `reads RSS anonymous RSS and swap in KB from one status file`() {
        procProvider.statusContent = "Name:\tsample\nVmRSS:\t 5000 kB\nRssAnon:  4000   kB\nVmSwap:\t200 kB\n"

        Assert.assertEquals(ProcStatusMemory(5000, 4000, 200), memoryReader.readProcStatus())
        Assert.assertEquals(1, procProvider.statusFileAccessCount)
    }

    @Test
    fun `missing fields are unavailable while zero swap is valid`() {
        procProvider.statusContent = "VmRSS: 5000 kB\nVmSwap: 0 kB"

        Assert.assertEquals(ProcStatusMemory(rss = 5000, swap = 0), memoryReader.readProcStatus())
    }

    @Test
    fun `invalid fields do not prevent reading valid fields`() {
        for (invalid in listOf("broken kB", "-1 kB", "9223372036854775808 kB", "123 MB", "123", "")) {
            procProvider.statusContent = "VmRSS: 5000 kB\nRssAnon: $invalid\nVmSwap: 200 kB"

            Assert.assertEquals(ProcStatusMemory(rss = 5000, swap = 200), memoryReader.readProcStatus())
        }
    }

    @Test
    fun `missing or unreadable status file returns unavailable fields`() {
        procProvider.statusFileOverride = tempFolder.root.resolve("missing")
        Assert.assertEquals(ProcStatusMemory(), memoryReader.readProcStatus())

        procProvider.statusFileOverride = tempFolder.root
        Assert.assertEquals(ProcStatusMemory(), memoryReader.readProcStatus())
    }

    @Test
    fun `each measurement reads current status values`() {
        Assert.assertEquals(ProcStatusMemory(5000, 4000, 200), memoryReader.readProcStatus())
        procProvider.statusContent = "VmRSS: 6000 kB\nRssAnon: 4500 kB\nVmSwap: 300 kB"

        Assert.assertEquals(ProcStatusMemory(6000, 4500, 300), memoryReader.readProcStatus())
        Assert.assertEquals(2, procProvider.statusFileAccessCount)
    }

    @Test
    fun `reads the total native heap size from Debug and returns it in KB`() {
        val actual = debugProvider.getNativeHeapSize() / BYTES_TO_KB_FACTOR
        val expected = memoryReader.nativeTotalHeapSize()
        Assert.assertEquals(expected, actual)
    }

    @Test
    fun `reads the free native heap size from Debug and returns it in KB`() {
        val actual = debugProvider.getNativeHeapFreeSize() / BYTES_TO_KB_FACTOR
        val expected = memoryReader.nativeFreeHeapSize()
        Assert.assertEquals(expected, actual)
    }
}
