package sh.measure.android.events

import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent

class EventTransformerKtTest {

    @Test
    fun `modifies event and returns the updated event`() {
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                event.sessionId = "sessionId"
                return event
            }
        }
        val transformedEvent = event.transform(listOf(transformer))
        assertEquals("sessionId", transformedEvent!!.sessionId)
    }

    @Test
    fun `returns null event if transformer returns null`() {
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T>? = null
        }
        val transformedEvent = event.transform(listOf(transformer))
        assertEquals(null, transformedEvent)
    }

    @Test
    fun `noop when no transformers are passed`() {
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)
        val transformedEvent = event.transform(emptyList())
        assertEquals(event, transformedEvent)
    }
}
