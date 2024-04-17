package sh.measure.android.storage

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.events.Attachment
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeSessionIdProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.gestures.ClickData
import sh.measure.android.gestures.LongClickData
import sh.measure.android.gestures.ScrollData
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.lifecycle.ApplicationLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleData
import sh.measure.android.navigation.NavigationData
import sh.measure.android.networkchange.NetworkChangeData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.performance.CpuUsageData
import sh.measure.android.performance.LowMemoryData
import sh.measure.android.performance.MemoryUsageData
import sh.measure.android.performance.TrimMemoryData
import java.io.File

internal class EventStoreTest {
    private val logger = NoopLogger()
    private val fileStorage = mock<FileStorage>()
    private val database = mock<Database>()
    private val idProvider = FakeIdProvider()
    private val sessionIdProvider = FakeSessionIdProvider()

    private val eventStore: EventStore = EventStoreImpl(
        logger,
        fileStorage,
        database,
        idProvider,
        sessionIdProvider,
    )

    @Test
    fun `stores unhandled exception event in file and database`() {
        val eventId = idProvider.id
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getExceptionData(),
            type = EventType.EXCEPTION,
        )
        `when`(fileStorage.writeException(eventId, event)).thenReturn(eventId)

        // When
        eventStore.storeUnhandledException(event)

        // Then
        verify(fileStorage).writeException(eventId, event)
        verify(database).insertEvent(
            EventEntity(
                id = eventId,
                type = EventType.EXCEPTION,
                timestamp = event.timestamp,
                filePath = eventId,
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `stores ANR event in file and database`() {
        val eventId = idProvider.id
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getExceptionData(),
            type = EventType.ANR,
        )
        `when`(fileStorage.writeAnr(eventId, event)).thenReturn(eventId)

        // When
        eventStore.storeAnr(event)

        // Then
        verify(fileStorage).writeAnr(eventId, event)
        verify(database).insertEvent(
            EventEntity(
                id = eventId,
                type = EventType.ANR,
                timestamp = event.timestamp,
                filePath = eventId,
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores click event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getClickData(),
            type = EventType.CLICK,
        )

        // When
        eventStore.storeClick(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.CLICK,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(ClickData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores long click event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getLongClickData(),
            type = EventType.LONG_CLICK,
        )

        // When
        eventStore.storeLongClick(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LONG_CLICK,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(LongClickData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores scroll event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getScrollData(),
            type = EventType.SCROLL,
        )

        // When
        eventStore.storeScroll(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.SCROLL,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(ScrollData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores activity lifecycle event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getActivityLifecycleData(),
            type = EventType.LIFECYCLE_ACTIVITY,
        )

        // When
        eventStore.storeActivityLifecycle(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LIFECYCLE_ACTIVITY,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(
                    ActivityLifecycleData.serializer(),
                    event.data,
                ),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,

            ),
        )
    }

    @Test
    fun `serializes and stores fragment lifecycle event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getFragmentLifecycleData(),
            type = EventType.LIFECYCLE_FRAGMENT,
        )

        // When
        eventStore.storeFragmentLifecycle(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LIFECYCLE_FRAGMENT,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(
                    FragmentLifecycleData.serializer(),
                    event.data,
                ),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores application lifecycle event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getApplicationLifecycleData(),
            type = EventType.LIFECYCLE_APP,
        )

        // When
        eventStore.storeApplicationLifecycle(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LIFECYCLE_APP,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(
                    ApplicationLifecycleData.serializer(),
                    event.data,
                ),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores cold launch event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getColdLaunchData(),
            type = EventType.COLD_LAUNCH,
        )

        // When
        eventStore.storeColdLaunch(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.COLD_LAUNCH,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(ColdLaunchData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores warm launch event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getWarmLaunchData(),
            type = EventType.WARM_LAUNCH,
        )

        // When
        eventStore.storeWarmLaunch(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.WARM_LAUNCH,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(WarmLaunchData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores hot launch event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getHotLaunchData(),
            type = EventType.HOT_LAUNCH,
        )

        // When
        eventStore.storeHotLaunch(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.HOT_LAUNCH,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(HotLaunchData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores network change event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getNetworkChangeData(),
            type = EventType.NETWORK_CHANGE,
        )

        // When
        eventStore.storeNetworkChange(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.NETWORK_CHANGE,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(NetworkChangeData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores http event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getHttpData(),
            type = EventType.HTTP,
        )

        // When
        eventStore.storeHttp(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.HTTP,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(HttpData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores memory usage event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getMemoryUsageData(),
            type = EventType.MEMORY_USAGE,
        )

        // When
        eventStore.storeMemoryUsage(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.MEMORY_USAGE,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(MemoryUsageData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores low memory event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getLowMemoryData(),
            type = EventType.LOW_MEMORY,
        )

        // When
        eventStore.storeLowMemory(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LOW_MEMORY,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(LowMemoryData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores trim memory event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getTrimMemoryData(),
            type = EventType.TRIM_MEMORY,
        )

        // When
        eventStore.storeTrimMemory(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.TRIM_MEMORY,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(TrimMemoryData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores cpu usage event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getCpuUsageData(),
            type = EventType.CPU_USAGE,
        )

        // When
        eventStore.storeCpuUsage(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.CPU_USAGE,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(CpuUsageData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `serializes and stores navigation event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getNavigationData(),
            type = EventType.NAVIGATION,
        )

        // When
        eventStore.storeNavigation(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.NAVIGATION,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(NavigationData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = null,
                attachmentsSize = 0,
            ),
        )
    }

    @Test
    fun `stores events having attachments with path`() {
        // Given
        val attachmentPath = "attachment-path"
        val attachment = Attachment("name", "attachment-type", path = attachmentPath)
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getClickData(),
            type = EventType.CLICK,
        ).withAttachment(
            attachment,
        )

        val attachmentFile = fakeAttachmentFile()
        val attachmentFileSize = 123L
        `when`(fileStorage.getFile(attachmentPath)).thenReturn(attachmentFile)

        // When
        eventStore.storeClick(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.CLICK,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(ClickData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                attachmentEntities = listOf(
                    AttachmentEntity(
                        id = idProvider.id,
                        type = attachment.type,
                        name = attachment.name,
                        path = attachment.path!!,
                    ),
                ),
                serializedAttributes = null,
                attachmentsSize = attachmentFileSize,
                serializedAttachments = Json.encodeToString(listOf(attachment)),
            ),
        )
    }

    @Test
    fun `stores events having non-empty attributes`() {
        // Given
        val event = Event(
            timestamp = 1,
            data = FakeEventFactory.getClickData(),
            type = EventType.CLICK,
        ).withAttribute("key", "value")

        // When
        eventStore.storeClick(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.CLICK,
                timestamp = event.timestamp,
                serializedData = Json.encodeToString(ClickData.serializer(), event.data),
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = "{\"key\":\"value\"}",
                attachmentsSize = 0,
            ),
        )
    }

    private fun fakeAttachmentFile(): File {
        val file = File.createTempFile("fake-path", "txt")
        file.writeText(
            "lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        )
        return file
    }
}
