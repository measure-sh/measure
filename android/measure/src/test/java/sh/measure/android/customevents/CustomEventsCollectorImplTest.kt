package sh.measure.android.customevents

import org.junit.Before
import org.junit.Test
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import sh.measure.android.MeasureAttachment
import sh.measure.android.buildAttributes
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.FileStorage
import java.io.File

class CustomEventsCollectorImplTest {
    private val logger = NoopLogger()
    private val fakeTimeProvider = FakeTimeProvider()
    private val fileStorage = mock<FileStorage>()
    private val eventProcessor = mock<EventProcessor>()
    private val configProvider = FakeConfigProvider()
    private val customEventsCollector: CustomEventsCollector = CustomEventsCollectorImpl(
        logger = logger,
        eventProcessor = eventProcessor,
        timeProvider = fakeTimeProvider,
        configProvider = configProvider,
        fileStorage = fileStorage,
    )

    @Before
    fun setup() {
        `when`(fileStorage.getFile(any())).thenReturn(File.createTempFile("temp", "file"))
    }

    @Test
    fun `trackEvent given valid attributes and attachment, tracks event`() {
        // Given
        val name = "event_name"
        val attributes = buildAttributes { put("key", "value") }
        val attachment = MeasureAttachment("name", "type", "path")

        // When
        customEventsCollector.trackEvent(name, attributes, attachment)

        // Then
        verify(eventProcessor).track(
            CustomEventData(name),
            fakeTimeProvider.currentTimeSinceEpochInMillis,
            EventType.CUSTOM,
            attributes,
            mutableListOf(
                Attachment(name = attachment.name, type = attachment.type, path = attachment.path),
            ),
        )
    }

    @Test
    fun `trackEvent with attribute key exceeding max length, does not track event`() {
        // Given
        val name = "event_name"
        val attributes = buildAttributes { put("k".repeat(257), "value") }

        // When
        customEventsCollector.trackEvent(name, attributes, null)

        // Then
        Mockito.verifyNoInteractions(eventProcessor)
    }

    @Test
    fun `trackEvent with attribute value exceeding max length, does not track event`() {
        // Given
        val name = "event_name"
        val attributes = buildAttributes { put("key", "v".repeat(257)) }

        // When
        customEventsCollector.trackEvent(name, attributes, null)

        // Then
        Mockito.verifyNoInteractions(eventProcessor)
    }

    @Test
    fun `trackEvent with non-existent attachment file, does not track event`() {
        // Given
        val name = "event_name"
        val attributes = buildAttributes { put("key", "value") }
        val attachment = MeasureAttachment("name", "type", "path")
        `when`(fileStorage.getFile(attachment.path)).thenReturn(null)

        // When
        customEventsCollector.trackEvent(name, attributes, attachment)

        // Then
        Mockito.verifyNoInteractions(eventProcessor)
    }

    @Test
    fun `trackEvent with attributes count exceeding max allowed, does not track event`() {
        // Given
        val name = "event_name"
        val attributes = buildAttributes {
            for (i in 0..configProvider.maxUserDefinedAttributesPerEvent) {
                put("key$i", "value$i")
            }
        }

        // When
        customEventsCollector.trackEvent(name, attributes, null)

        // Then
        Mockito.verifyNoInteractions(eventProcessor)
    }
}
