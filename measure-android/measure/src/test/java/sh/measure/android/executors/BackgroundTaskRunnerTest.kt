package sh.measure.android.executors

import org.junit.Before
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService

class BackgroundTaskRunnerTest {

    private lateinit var taskRunner: BackgroundTaskRunner
    private lateinit var executorService: ExecutorService
    private lateinit var scheduledExecutorService: ScheduledExecutorService

    @Before
    fun setUp() {
        executorService = Executors.newFixedThreadPool(2)
        scheduledExecutorService = Executors.newScheduledThreadPool(1)
        taskRunner = BackgroundTaskRunner(Executors.defaultThreadFactory())
    }

    @Test
    fun `should execute tasks`() {
        val latch = CountDownLatch(1)
        taskRunner.execute {
            latch.countDown()
        }
        latch.await()
        assert(latch.count == 0L)
    }
}