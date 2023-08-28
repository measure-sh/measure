package sh.measure.sample.events

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import sh.measure.android.events.DefaultTracker
import sh.measure.android.events.EventBody
import sh.measure.android.events.EventType
import sh.measure.android.events.MeasureEvent
import sh.measure.android.events.sinks.Sink
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.resource.Resource

internal class DefaultTrackerTest {

    private lateinit var defaultTracker: DefaultTracker
    private lateinit var fakeEventSink1: FakeSink
    private lateinit var fakeEventSink2: FakeSink

    @Before
    fun setUp() {
        defaultTracker = DefaultTracker()
        fakeEventSink1 = FakeSink()
        fakeEventSink2 = FakeSink()
    }

    @Test
    fun `sends events to all registered event sinks`() {
        defaultTracker.addEventSink(fakeEventSink1)
        defaultTracker.addEventSink(fakeEventSink2)

        val measureEvent = createFakeMeasureEvent()
        defaultTracker.track(measureEvent)

        assertEquals(1, fakeEventSink1.getReceivedEvents().size)
        assertEquals(1, fakeEventSink2.getReceivedEvents().size)
        assertEquals(measureEvent, fakeEventSink1.getReceivedEvents()[0])
        assertEquals(measureEvent, fakeEventSink2.getReceivedEvents()[0])
    }

    private fun createFakeMeasureEvent(): MeasureEvent {
        return MeasureEvent(
            id = "id",
            body = EventBody(
                EventType.EXCEPTION,
                Json.encodeToJsonElement(
                    ExceptionData.serializer(),
                    ExceptionData(exceptions = listOf(), true)
                )
            ),
            resource = Resource(),
            attributes = null,
            timestamp = 0L
        )
    }
}

internal class FakeSink : Sink {
    private val receivedEvents: MutableList<MeasureEvent> = mutableListOf()

    override fun offer(event: MeasureEvent, immediate: Boolean) {
        receivedEvents.add(event)
    }

    fun getReceivedEvents(): List<MeasureEvent> {
        return receivedEvents
    }
}