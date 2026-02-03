package sh.measure.android.tracing

import org.junit.Assert
import org.junit.Test
import sh.measure.android.fakes.FakeSampler
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.NoopSpanProcessor
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.IdProviderImpl
import sh.measure.android.utils.RandomizerImpl
import sh.measure.android.utils.TestClock

class MsrSpanBuilderTest {
    private val idProvider = IdProviderImpl(randomizer = RandomizerImpl())
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val logger = NoopLogger()
    private val spanProcessor = NoopSpanProcessor()
    private val sessionManager = FakeSessionManager()
    private val sampler = FakeSampler()

    @Test
    fun `setsParent sets span parent`() {
        val parentSpan = MsrSpanBuilder(
            "parent-name",
            idProvider,
            timeProvider,
            spanProcessor,
            sessionManager,
            sampler,
            logger,
        ).startSpan()
        val span = MsrSpanBuilder(
            "span-name",
            idProvider,
            timeProvider,
            spanProcessor,
            sessionManager,
            sampler,
            logger,
        ).setParent(parentSpan).startSpan()

        Assert.assertEquals(parentSpan.spanId, span.parentId)
    }
}
