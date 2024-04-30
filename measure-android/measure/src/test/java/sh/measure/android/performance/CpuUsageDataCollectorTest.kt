package sh.measure.android.performance

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.OsSysConfProvider
import sh.measure.android.utils.ProcProvider
import java.io.File

internal class CpuUsageDataCollectorTest {
    private val logger = NoopLogger()
    private val eventProcessor = mock<EventProcessor>()
    private val processInfo = FakeProcessInfoProvider()
    private val procProvider = mock<ProcProvider>()
    private val osSysConfProvider = mock<OsSysConfProvider>()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private lateinit var cpuUsageCollector: CpuUsageCollector
    private lateinit var timeProvider: FakeTimeProvider

    @Before
    fun setUp() {
        val currentElapsedRealtime: Long = 20_000 // 20s
        timeProvider = FakeTimeProvider(fakeElapsedRealtime = currentElapsedRealtime)
        cpuUsageCollector = CpuUsageCollector(
            logger,
            eventProcessor,
            processInfo,
            timeProvider,
            executorService,
            procProvider,
            osSysConfProvider,
        )

        // setup mocks
        val file = createDummyProcStatFile()
        `when`(procProvider.getStatFile(processInfo.getPid())).thenReturn(file)
        // The OsConstants are all zero, hence we need to depend on sequence of calls in code.
        // The first call is for _SC_NPROCESSORS_CONF and the second call is for _SC_CLK_TCK.
        `when`(osSysConfProvider.get(0)).thenReturn(1, 100)
    }

    @Test
    fun `CpuUsageCollector tracks cpu usage`() {
        cpuUsageCollector.register()
        verify(eventProcessor).track(
            type = EventType.CPU_USAGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = CpuUsageData(
                num_cores = 1,
                clock_speed = 100,
                uptime = 20_000,
                utime = 500,
                stime = 600,
                cutime = 100,
                cstime = 200,
                start_time = 5835385,
                interval_config = CPU_TRACKING_INTERVAL_MS,
            ),
        )
    }

    @Test
    fun `CpuUsageCollector pauses and resumes`() {
        cpuUsageCollector.register()
        Assert.assertNotNull(cpuUsageCollector.future)
        cpuUsageCollector.pause()
        Assert.assertNull(cpuUsageCollector.future)
        cpuUsageCollector.resume()
        Assert.assertNotNull(cpuUsageCollector.future)
    }

    @Test
    fun `CpuUsageCollector does not track if not foreground process`() {
        processInfo.foregroundProcess = false
        cpuUsageCollector.register()
        assertNull(cpuUsageCollector.future)
    }

    /**
     * utime: 500
     * stime: 600
     * cutime: 100
     * cstime: 200
     * start_time: 5835385
     */
    private fun createDummyProcStatFile(): File {
        return File.createTempFile("stat", null).apply {
            writeText(
                "15354 (.measure.sample) R 1274 1274 0 0 -1 4194624 16399 0 0 0 500 600 100 200 30 10 24 0 5835385 15334526976 31865 18446744073709551615 434698489856 434698501984 548727546288 0 0 0 4612 1 1073775864 0 0 0 17 7 0 0 0 0 0 434698502144 434698503416 434785861632 548727550460 548727550559 548727550559 548727554014 0",
            )
        }
    }
}
