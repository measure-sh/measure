package sh.measure.android.performance

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.OsSysConfProvider
import sh.measure.android.utils.ProcProvider
import sh.measure.android.utils.TestClock
import java.io.File
import java.time.Duration

internal class CpuUsageCollectorTest {
    private val logger = NoopLogger()
    private val signalProcessor = mock<SignalProcessor>()
    private val processInfo = FakeProcessInfoProvider()
    private val procProvider = mock<ProcProvider>()
    private val osSysConfProvider = mock<OsSysConfProvider>()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val configProvider = FakeConfigProvider()
    private val cpuUsageCollector: CpuUsageCollector = CpuUsageCollector(
        logger,
        signalProcessor,
        processInfo,
        timeProvider,
        executorService,
        configProvider,
        procProvider,
        osSysConfProvider,
    )

    @Before
    fun setUp() {
        // setup mocks
        val file = createDummyProcStatFile(
            utime = 400,
            stime = 500,
            cuTime = 600,
            csTime = 700,
            startTime = 58385,
        )
        `when`(procProvider.getStatFile(processInfo.getPid())).thenReturn(file)
        // The OsConstants are all zero, hence we need to depend on sequence of calls in code.
        // The first call is for _SC_NPROCESSORS_CONF and the second call is for _SC_CLK_TCK.
        `when`(osSysConfProvider.get(0)).thenReturn(1, 100)
    }

    @Test
    fun `CpuUsageCollector tracks cpu usage data`() {
        val file = createDummyProcStatFile(
            utime = 100,
            stime = 200,
            cuTime = 300,
            csTime = 400,
            startTime = 5835385,
        )
        `when`(procProvider.getStatFile(processInfo.getPid())).thenReturn(file)

        cpuUsageCollector.register()
        verify(signalProcessor).track(
            type = EventType.CPU_USAGE,
            timestamp = timeProvider.now(),
            data = CpuUsageData(
                num_cores = 1,
                clock_speed = 100,
                uptime = timeProvider.now(),
                utime = 100,
                stime = 200,
                cutime = 300,
                cstime = 400,
                start_time = 5835385,
                interval = 0,
                percentage_usage = 0.0,
            ),
        )
    }

    @Test
    fun `calculates percentage cpu usage`() {
        val result = calculatePercentageUsage(
            utime = 300,
            stime = 400,
            cutime = 500,
            cstime = 600,
            uptime = 2000,
            previousUtime = 200,
            previousStime = 300,
            previousCutime = 400,
            previousCstime = 500,
            previousUptime = 1000,
            numCores = 8,
            clockSpeedHz = 100,
        )
        // verified manually using the formula:
        // ((utime + stime + cutime + cstime)
        //   - (previousUtime + previousStime + previousCutime + previousCstime))
        // divided by
        // (((uptime - previousUptime) / previousUptime) * numCores * clockSpeedHz)
        //
        // and then multiply the result by 100.
        Assert.assertEquals(50.0, result, 0.0)
    }

    @Test
    fun `cpu usage calculation returns 0 when CPU cores are 0`() {
        val result = calculatePercentageUsage(
            utime = 300,
            stime = 400,
            cutime = 500,
            cstime = 600,
            uptime = 2000,
            previousUtime = 200,
            previousStime = 300,
            previousCutime = 400,
            previousCstime = 500,
            previousUptime = 1000,
            numCores = 0,
            clockSpeedHz = 100,
        )
        Assert.assertEquals(0.0, result, 0.0)
    }

    @Test
    fun `cpu usage calculation returns 0 when uptime between previous and current reading is same`() {
        val result = calculatePercentageUsage(
            utime = 300,
            stime = 400,
            cutime = 500,
            cstime = 600,
            uptime = 1000,
            previousUtime = 200,
            previousStime = 300,
            previousCutime = 400,
            previousCstime = 500,
            previousUptime = 1000,
            numCores = 0,
            clockSpeedHz = 100,
        )
        Assert.assertEquals(0.0, result, 0.0)
    }

    @Test
    fun `cpu usage calculation does not return negative usage, instead returns 0`() {
        val result = calculatePercentageUsage(
            utime = 100,
            stime = 200,
            cutime = 300,
            cstime = 400,
            uptime = 2000,
            previousUtime = 200,
            previousStime = 300,
            previousCutime = 400,
            previousCstime = 500,
            previousUptime = 1000,
            numCores = 0,
            clockSpeedHz = 100,
        )
        Assert.assertEquals(0.0, result, 0.0)
    }

    @Test
    fun `CpuUsageCollector does not track if not foreground process`() {
        processInfo.foregroundProcess = false
        cpuUsageCollector.register()
        assertNull(cpuUsageCollector.future)
    }

    @Test
    fun `CpuUsageCollector calculates interval dynamically`() {
        val initialTimeMillis = timeProvider.elapsedRealtime
        cpuUsageCollector.prevCpuUsageData = CpuUsageData(
            num_cores = 1,
            clock_speed = 100,
            uptime = initialTimeMillis,
            utime = 100,
            stime = 200,
            cutime = 300,
            cstime = 400,
            start_time = 58185,
            interval = 0,
            percentage_usage = 0.0,
        )

        val advancedTime = Duration.ofMillis(15000)
        testClock.advance(advancedTime)
        cpuUsageCollector.register()
        verify(signalProcessor).track(
            type = EventType.CPU_USAGE,
            timestamp = timeProvider.now(),
            data = CpuUsageData(
                num_cores = 1,
                clock_speed = 100,
                uptime = initialTimeMillis + advancedTime.toMillis(),
                utime = 400,
                stime = 500,
                cutime = 600,
                cstime = 700,
                start_time = 58385,
                interval = advancedTime.toMillis(),
                // calculate manually using the formula:
                // ((utime + stime + cutime + cstime)
                //   - (previousUtime + previousStime + previousCutime + previousCstime))
                // divided by
                // (((uptime - previousUptime) / previousUptime) * numCores * clockSpeedHz)
                percentage_usage = 80.0,
            ),
        )
    }

    private fun createDummyProcStatFile(
        utime: Long = 500,
        stime: Long = 600,
        cuTime: Long = 100,
        csTime: Long = 200,
        startTime: Long = 5835385,
    ): File = File.createTempFile("stat", null).apply {
        writeText(
            "15354 (.measure.sample) R 1274 1274 0 0 -1 4194624 16399 0 0 0 $utime $stime $cuTime $csTime 30 10 24 0 $startTime 15334526976 31865 18446744073709551615 434698489856 434698501984 548727546288 0 0 0 4612 1 1073775864 0 0 0 17 7 0 0 0 0 0 434698502144 434698503416 434785861632 548727550460 548727550559 548727550559 548727554014 0",
        )
    }
}
