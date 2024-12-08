package sh.measure.android.tracing

import org.junit.Assert
import org.junit.Test
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.FakeTraceSampler
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.NoopSpanProcessor
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.IdProviderImpl
import sh.measure.android.utils.RandomizerImpl
import sh.measure.android.utils.TestClock

class SpanStorageTest {
    private val idProvider = IdProviderImpl(RandomizerImpl())
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val logger = NoopLogger()
    private val spanProcessor = NoopSpanProcessor()
    private val sessionManager = FakeSessionManager()
    private val traceSampler = FakeTraceSampler()

    @Test
    fun `current returns null by default`() {
        Assert.assertNull(SpanStorage.instance.current())
    }

    @Test
    fun `makeCurrent sets span as current`() {
        val span = MsrSpanBuilder(
            "span-name",
            idProvider,
            timeProvider,
            spanProcessor,
            sessionManager,
            traceSampler,
            logger,
        ).startSpan()
        val scope = SpanStorage.instance.makeCurrent(span)
        Assert.assertEquals(span, SpanStorage.instance.current())
        scope.close()
    }

    @Test
    fun `closing the scope resets the current span`() {
        val spanA = MsrSpanBuilder(
            "span-A",
            idProvider,
            timeProvider,
            spanProcessor,
            sessionManager,
            traceSampler,
            logger,
        ).startSpan()
        val spanB = MsrSpanBuilder(
            "span-B",
            idProvider,
            timeProvider,
            spanProcessor,
            sessionManager,
            traceSampler,
            logger,
        ).startSpan()
        val spanAScope = SpanStorage.instance.makeCurrent(spanA)
        val spanBScope = SpanStorage.instance.makeCurrent(spanB)
        Assert.assertEquals(spanB, SpanStorage.instance.current())
        spanBScope.close()
        Assert.assertEquals(spanA, SpanStorage.instance.current())
        spanAScope.close()
        Assert.assertEquals(null, SpanStorage.instance.current())
    }

    @Test
    fun `closing scope out of order ignores the request`() {
        val spanA = MsrSpanBuilder(
            "span-A",
            idProvider,
            timeProvider,
            spanProcessor,
            sessionManager,
            traceSampler,
            logger,
        ).startSpan()
        val spanB = MsrSpanBuilder(
            "span-B",
            idProvider,
            timeProvider,
            spanProcessor,
            sessionManager,
            traceSampler,
            logger,
        ).startSpan()
        val spanC = MsrSpanBuilder(
            "span-C",
            idProvider,
            timeProvider,
            spanProcessor,
            sessionManager,
            traceSampler,
            logger,
        ).startSpan()

        val scopeA = SpanStorage.instance.makeCurrent(spanA)
        val scopeB = SpanStorage.instance.makeCurrent(spanB)
        val scopeC = SpanStorage.instance.makeCurrent(spanC)

        Assert.assertEquals(spanC, SpanStorage.instance.current())

        // closing scopeB will be ignored as it's not the current span.
        scopeB.close()
        Assert.assertEquals(spanC, SpanStorage.instance.current())

        // closing scopeC will work as expected, making spanB the current span.
        scopeC.close()
        Assert.assertEquals(spanB, SpanStorage.instance.current())

        // closing scopeB will work as expected, making spanA the current span.
        scopeB.close()
        Assert.assertEquals(spanA, SpanStorage.instance.current())

        // closing scopeB will work as expected, making spanA the current span.
        scopeA.close()
        Assert.assertNull(SpanStorage.instance.current())
    }

    @Test
    fun `making same span current multiple times creates new scopes`() {
        val span = MsrSpanBuilder(
            "span-name",
            idProvider,
            timeProvider,
            spanProcessor,
            sessionManager,
            traceSampler,
            logger,
        ).startSpan()
        val scope1 = SpanStorage.instance.makeCurrent(span)
        val scope2 = SpanStorage.instance.makeCurrent(span)

        Assert.assertEquals(span, SpanStorage.instance.current())
        scope2.close()
        // Still current because of scope1
        Assert.assertEquals(span, SpanStorage.instance.current())
        scope1.close()
        Assert.assertNull(SpanStorage.instance.current())
    }
}
