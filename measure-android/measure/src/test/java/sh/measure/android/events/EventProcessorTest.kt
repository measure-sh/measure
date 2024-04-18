package sh.measure.android.events

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent
import sh.measure.android.fakes.FakeEventStore
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeSessionIdProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger

internal class EventProcessorTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val idProvider = FakeIdProvider()
    private val sessionIdProvider = FakeSessionIdProvider()
    private val eventStore = FakeEventStore()

    private val eventProcessor = EventProcessorImpl(
        logger = NoopLogger(),
        executorService = executorService,
        eventStore = eventStore,
        idProvider = idProvider,
        sessionIdProvider = sessionIdProvider,
        attributeProcessors = emptyList()
    )

    @Test
    fun `given an event, adds session id, event id and thread name as attribute, then stores event`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        val expectedEvent = exceptionData.toEvent(
            type = type,
            timestamp = timestamp,
            id = idProvider.id,
            sessionId = sessionIdProvider.sessionId,
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        assertEquals(1, eventStore.trackedEvents.size)
        assertEquals(expectedEvent, eventStore.trackedEvents.first())
    }

    @Test
    fun `given event with attachments, adds session id, event id and thread name as attribute, then stores event`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        val attachments = listOf(FakeEventFactory.getAttachment())

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            attachments = attachments,
        )

        val expectedEvent = exceptionData.toEvent(
            type = type,
            timestamp = timestamp,
            id = idProvider.id,
            sessionId = sessionIdProvider.sessionId,
            attachments = attachments,
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        assertEquals(1, eventStore.trackedEvents.size)
        assertEquals(expectedEvent, eventStore.trackedEvents.first())
    }

    @Test
    fun `given event with attributes, adds session id, event id and thread name as attribute, then stores event`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        val attributes: MutableMap<String, Any?> = mutableMapOf("key" to "value")

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            attributes = attributes,
        )

        val expectedEvent = exceptionData.toEvent(
            type = type,
            timestamp = timestamp,
            id = idProvider.id,
            sessionId = sessionIdProvider.sessionId,
            attributes = attributes,
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        assertEquals(1, eventStore.trackedEvents.size)
        assertEquals(expectedEvent, eventStore.trackedEvents.first())
    }

    @Test
    fun `given attribute processors are provided, applies them to the event`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        val attributeProcessor = object: AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributes["key"] = "value"
            }
        }
        val eventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            idProvider = idProvider,
            sessionIdProvider = sessionIdProvider,
            attributeProcessors = listOf(attributeProcessor)
        )

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        val expectedEvent = exceptionData.toEvent(
            type = type,
            timestamp = timestamp,
            id = idProvider.id,
            sessionId = sessionIdProvider.sessionId,
            attributes = mutableMapOf("key" to "value"),
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        assertEquals(1, eventStore.trackedEvents.size)
        assertEquals(expectedEvent, eventStore.trackedEvents.first())
    }
}
