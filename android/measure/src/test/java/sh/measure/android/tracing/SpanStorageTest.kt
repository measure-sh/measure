package sh.measure.android.tracing

import org.junit.Assert
import org.junit.Test
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import sh.measure.android.utils.UUIDProvider

class SpanStorageTest {
    private val idProvider = UUIDProvider()
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val logger = NoopLogger()

    @Test
    fun `current returns null by default`() {
        Assert.assertNull(SpanStorage.instance.current())
    }

    @Test
    fun `makeCurrent sets span as current`() {
        val span = MsrSpanBuilder("span-name", idProvider, timeProvider, logger).startSpan()
        val scope = span.makeCurrent()
        Assert.assertEquals(span, SpanStorage.instance.current())
        scope.close()
    }

    @Test
    fun `closing the scope resets the current span`() {
        val spanA = MsrSpanBuilder("span-A", idProvider, timeProvider, logger).startSpan()
        val spanB = MsrSpanBuilder("span-B", idProvider, timeProvider, logger).startSpan()
        val spanAScope = spanA.makeCurrent()
        val spanBScope = spanB.makeCurrent()
        Assert.assertEquals(spanB, SpanStorage.instance.current())
        spanBScope.close()
        Assert.assertEquals(spanA, SpanStorage.instance.current())
        spanAScope.close()
        Assert.assertEquals(null, SpanStorage.instance.current())
    }
}
