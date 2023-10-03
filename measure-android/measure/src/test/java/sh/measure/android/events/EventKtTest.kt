package sh.measure.android.events

import org.junit.Test
import sh.measure.android.exceptions.ExceptionFactory

class EventKtTest {

    @Test
    fun `MeasureException toEvent() returns an event of type Exception, when exception is not an ANR`() {
        val event = ExceptionFactory.createMeasureException(
            throwable = Exception("Test exception"),
            handled = false,
            timestamp = 0L,
            thread = Thread.currentThread(),
            isAnr = false
        ).toEvent()

        assert(event.type == EventType.EXCEPTION)
    }

    @Test
    fun `MeasureException toEvent() returns an event of type ANR, when exception is an ANR`() {
        val event = ExceptionFactory.createMeasureException(
            throwable = Exception("Test exception"),
            handled = false,
            timestamp = 0L,
            thread = Thread.currentThread(),
            isAnr = true
        ).toEvent()

        assert(event.type == EventType.ANR)
    }
}