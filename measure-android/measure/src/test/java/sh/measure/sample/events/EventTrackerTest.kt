package sh.measure.sample.events

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import sh.measure.sample.exceptions.ExceptionData
import sh.measure.sample.resource.Resource

internal class EventTrackerTest {

    private lateinit var eventTracker: EventTracker
    private lateinit var fakeEventSink1: FakeEventSink
    private lateinit var fakeEventSink2: FakeEventSink

    @Before
    fun setUp() {
        eventTracker = EventTracker()
        fakeEventSink1 = FakeEventSink()
        fakeEventSink2 = FakeEventSink()
    }

    @Test
    fun `sends events to all registered event sinks`() {
        eventTracker.addEventSink(fakeEventSink1)
        eventTracker.addEventSink(fakeEventSink2)

        val measureEvent = createFakeMeasureEvent()
        eventTracker.track(measureEvent)

        assertEquals(1, fakeEventSink1.getReceivedEvents().size)
        assertEquals(1, fakeEventSink2.getReceivedEvents().size)
        assertEquals(measureEvent, fakeEventSink1.getReceivedEvents()[0])
        assertEquals(measureEvent, fakeEventSink2.getReceivedEvents()[0])
    }

    private fun createFakeMeasureEvent(): MeasureEvent {
        return MeasureEvent(
            id = "id",
            type = EventType.EXCEPTION,
            resource = Resource(),
            attributes = Json.encodeToJsonElement(
                ExceptionData.serializer(),
                ExceptionData(exceptions = listOf(), true)
            ),
            session_id = "session_id",
            context = null,
            timestamp = "timestamp"
        )
    }
}

internal class FakeEventSink : EventSink {
    private val receivedEvents: MutableList<MeasureEvent> = mutableListOf()

    override fun send(event: MeasureEvent) {
        receivedEvents.add(event)
    }

    fun getReceivedEvents(): List<MeasureEvent> {
        return receivedEvents
    }
}