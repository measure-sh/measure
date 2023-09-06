package sh.measure.sample.events

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import sh.measure.android.events.DefaultTracker
import sh.measure.android.events.EventType
import sh.measure.android.events.MeasureEvent
import sh.measure.android.events.MeasureEventFactory
import sh.measure.android.events.sinks.Sink
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.resource.Resource
import sh.measure.android.time.DateProvider

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
        return MeasureEventFactory.createMeasureEvent(id = "id",
            value = Json.encodeToJsonElement(
                ExceptionData.serializer(), ExceptionData(exceptions = listOf(), true)
            ),
            type = EventType.EXCEPTION,
            resource = Resource(),
            attributes = null,
            dateProvider = object : DateProvider {
                override val currentTimeSinceEpochInMillis: Long
                    get() = 1693819118084
                override val currentTimeSinceEpochInNanos: Long
                    get() = 1693819118084
                override val uptimeInMillis: Long
                    get() = 1693819118084
            },
            idProvider = object : sh.measure.android.id.IdProvider {
                override fun createId(): String {
                    return "id"
                }
            })
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