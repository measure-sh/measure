package sh.measure.android.performance

import android.os.Debug
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import sh.measure.android.fakes.FakeDebugProvider
import sh.measure.android.fakes.FakeProcProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.DefaultRuntimeProvider
import sh.measure.android.utils.OsSysConfProvider

internal class DefaultMemoryReaderTest {
    private val debugProvider = FakeDebugProvider()
    private val processInfo = FakeProcessInfoProvider()
    private val procProvider = FakeProcProvider()
    private val osSysConfProvider = mock<OsSysConfProvider>()
    private val pageSizeBytes: Long = 4096

    // Using the real implementation of RuntimeProvider as it is available in tests.
    private val runtimeProvider = DefaultRuntimeProvider()

    private val memoryReader = DefaultMemoryReader(
        logger = NoopLogger(),
        debugProvider = debugProvider,
        runtimeProvider = runtimeProvider,
        processInfo = processInfo,
        procProvider = procProvider,
        osSysConfProvider = osSysConfProvider,
    )

    @Before
    fun setUp() {
        `when`(osSysConfProvider.get(any())).thenReturn(pageSizeBytes)
    }

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
    fun `reads RSS from statm file, multiples it by pageSize and returns the RSS in KB`() {
        val actual = memoryReader.rss()
        val pageSizeKB = pageSizeBytes / BYTES_TO_KB_FACTOR
        val expected = procProvider.rss * pageSizeKB
        Assert.assertEquals(expected, actual)
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
