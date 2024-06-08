package sh.measure.android.exporter

import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.atMostOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.AttachmentEntity
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.storage.FileStorage

/**
 * Tests for [PeriodicEventExporter]. This test uses Robolectric to allow using a real database
 * instance. This makes it easier to test this class, without needing excessive mocking or incurring
 * test induced design
 */
@RunWith(AndroidJUnit4::class)
class PeriodicEventExporterTest {
    private val logger = NoopLogger()
    private val configProvider = FakeConfigProvider()
    private val idProvider = FakeIdProvider()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val timeProvider = FakeTimeProvider()
    private val heartbeat = mock<Heartbeat>()
    private val networkClient = mock<NetworkClient>()
    private val fileStorage = mock<FileStorage>()
    private val database =
        DatabaseImpl(InstrumentationRegistry.getInstrumentation().context, logger)
    private val batchCreator = BatchCreatorImpl(logger, idProvider, database, configProvider, timeProvider)

    private val exporter = PeriodicEventExporterImpl(
        logger,
        configProvider,
        executorService,
        database,
        fileStorage,
        networkClient,
        timeProvider,
        heartbeat,
        batchCreator,
    )

    @Test
    fun `adds a listener to heartbeat on initialization`() {
        verify(heartbeat).addListener(exporter)
    }

    @Test
    fun `starts heartbeat when app comes to foreground with a delay`() {
        exporter.onAppForeground()

        verify(heartbeat, atMostOnce()).start(configProvider.eventsBatchingIntervalMs, configProvider.eventsBatchingIntervalMs)
    }

    @Test
    fun `starts heartbeat on cold launch with a delay`() {
        exporter.onColdLaunch()

        verify(heartbeat, atMostOnce()).start(configProvider.eventsBatchingIntervalMs, configProvider.eventsBatchingIntervalMs)
    }

    @Test
    fun `stops heartbeat when app goes to background`() {
        exporter.onAppBackground()

        verify(heartbeat, atMostOnce()).stop()
    }

    @Test
    fun `attempts export when app goes to background`() {
        // setup database to have a batch to export
        val eventEntity = FakeEventFactory.fakeEventEntity(eventId = "event-id")
        val batchId = "batch-id"
        database.insertEvent(eventEntity)
        database.insertBatch(listOf(eventEntity.id), batchId, 987654321L)

        exporter.onAppBackground()

        val eventPacket = FakeEventFactory.getEventPacket(eventEntity)
        val attachmentPackets = FakeEventFactory.getAttachmentPackets(eventEntity)
        verify(networkClient).execute(batchId, listOf(eventPacket), attachmentPackets)
    }

    @Test
    fun `given existing batch is available, then exports it`() {
        val eventEntity = FakeEventFactory.fakeEventEntity(eventId = "event-id")
        val eventPacket = FakeEventFactory.getEventPacket(eventEntity)
        val attachmentPackets = FakeEventFactory.getAttachmentPackets(eventEntity)
        val batchId = "batch-id"
        database.insertEvent(eventEntity)
        database.insertBatch(listOf(eventEntity.id), batchId, 987654321L)

        exporter.pulse()

        verify(networkClient).execute(batchId, listOf(eventPacket), attachmentPackets)
    }

    @Test
    fun `given batch is not available, and events are available, then creates new batch and exports it`() {
        configProvider.eventsBatchingIntervalMs = 0
        exporter.lastBatchCreationUptimeMs = 0
        configProvider.maxAttachmentSizeInEventsBatch = 1000
        val eventEntity = FakeEventFactory.fakeEventEntity(eventId = "event-id")
        val eventPacket = FakeEventFactory.getEventPacket(eventEntity)
        val attachmentPackets = FakeEventFactory.getAttachmentPackets(eventEntity)
        database.insertEvent(eventEntity)

        exporter.pulse()

        verify(networkClient).execute(idProvider.id, listOf(eventPacket), attachmentPackets)
    }

    @Test
    fun `given the last batch was created less than the minimum threshold, does not create a new batch `() {
        configProvider.eventsBatchingIntervalMs = 5
        exporter.lastBatchCreationUptimeMs = 1000
        timeProvider.time = 1004
        val eventEntity = FakeEventFactory.fakeEventEntity(eventId = "event-id")
        database.insertEvent(eventEntity)

        exporter.pulse()

        assertEquals(0, database.getBatchesCount())
    }

    @Test
    fun `given a batch export succeeds, deletes the events and the batch from database`() {
        `when`(networkClient.execute(any(), any(), any())).thenReturn(true)
        triggerExport()

        assertEquals(0, database.getEventsCount())
        assertEquals(0, database.getBatchesCount())
    }

    @Test
    fun `given a batch export succeeds, deletes the events from file storage`() {
        `when`(networkClient.execute(any(), any(), any())).thenReturn(true)
        val eventEntity = FakeEventFactory.fakeEventEntity(
            eventId = "event-id",
            attachmentEntities = listOf(
                AttachmentEntity("attachment-id", type = "type", path = "path", name = "name"),
            ),
        )
        val batchId = "batch-id"
        database.insertEvent(eventEntity)
        database.insertBatch(listOf(eventEntity.id), batchId, 987654321L)
        exporter.pulse()

        verify(fileStorage).deleteEventsIfExist(listOf("event-id"), listOf("attachment-id"))
    }

    @Test
    fun `given a batch export fails, events and batches are not deleted`() {
        `when`(networkClient.execute(any(), any(), any())).thenReturn(false)
        triggerExport()

        assertEquals(1, database.getEventsCount())
        assertEquals(1, database.getBatchesCount())
    }

    private fun triggerExport() {
        val eventEntity = FakeEventFactory.fakeEventEntity(eventId = "event-id")
        val batchId = "batch-id"
        database.insertEvent(eventEntity)
        database.insertBatch(listOf(eventEntity.id), batchId, 987654321L)
        exporter.pulse()
    }
}
