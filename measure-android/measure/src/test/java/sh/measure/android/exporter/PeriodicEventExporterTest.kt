package sh.measure.android.exporter

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.atMostOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import sh.measure.android.fakes.FakeConfig
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.BatchEventEntity
import sh.measure.android.storage.Database

class PeriodicEventExporterTest {
    private val logger = NoopLogger()
    private val config = FakeConfig()
    private val idProvider = FakeIdProvider()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val database = mock<Database>()
    private val heartbeat = mock<Heartbeat>()
    private val networkClient = mock<NetworkClient>()

    private val exporter = PeriodicEventExporterImpl(
        logger, config, idProvider, executorService, database, networkClient, heartbeat
    )

    @Test
    fun `adds a listener to heartbeat`() {
        verify(heartbeat).addListener(exporter)
    }

    @Test
    fun `triggers batch creation when heartbeat pulse occurs`() {
        returnEmptyEventsToBatchFromDb()
        assertFalse(exporter.isBatchingInProgress.get())
        exporter.pulse()
        assertTrue(exporter.isBatchingInProgress.get())
    }

    @Test
    fun `triggers batch creation when app goes to background`() {
        returnEmptyEventsToBatchFromDb()
        assertFalse(exporter.isBatchingInProgress.get())
        exporter.onAppBackground()
        assertTrue(exporter.isBatchingInProgress.get())
    }

    @Test
    fun `starts heartbeat when app comes to foreground`() {
        exporter.onAppForeground()

        verify(heartbeat, atMostOnce()).start(config.batchingIntervalMs)
    }

    @Test
    fun `starts heartbeat on cold launch`() {
        exporter.onColdLaunch()

        verify(heartbeat, atMostOnce()).start(config.batchingIntervalMs)
    }

    @Test
    fun `stops heartbeat when app goes to background`() {
        returnEmptyEventsToBatchFromDb()
        exporter.onAppBackground()

        verify(heartbeat, atMostOnce()).stop()
    }

    @Test
    fun `only one batch creation operation is allowed at a time`() {
        returnEmptyEventsToBatchFromDb()
        exporter.pulse()
        exporter.pulse()

        verify(database, atMostOnce()).getEventsToBatch(config.maxEventsBatchSize, true)
    }

    @Test
    fun `given no events to batch, does not create a batch`() {
        returnEmptyEventsToBatchFromDb()
        exporter.pulse()

        verify(database, never()).insertBatchedEventIds(any(), any())
    }

    @Test
    fun `given events to batch have attachments size more than max attachment size, filters events`() {
        config.maxAttachmentSizeInBytes = 600
        val batchId = idProvider.id
        val eventIdAttachmentSizeMap = LinkedHashMap<String, Long>()
        eventIdAttachmentSizeMap["event1"] = 100
        eventIdAttachmentSizeMap["event2"] = 200
        eventIdAttachmentSizeMap["event3"] = 300
        eventIdAttachmentSizeMap["event4"] = 400
        eventIdAttachmentSizeMap["event5"] = 500
        `when`(database.getEventsToBatch(config.maxEventsBatchSize, true)).thenReturn(
            BatchEventEntity(
                eventIdAttachmentSizeMap, 1500
            )
        )
        exporter.pulse()

        verify(database).insertBatchedEventIds(listOf("event1", "event2", "event3"), batchId)
    }

    @Test
    fun `given a batch is created successfully, exports events and attachments`() {
        `when`(database.getEventsToBatch(config.maxEventsBatchSize, true)).thenReturn(
            BatchEventEntity(
                LinkedHashMap(mapOf("event1" to 100L, "event2" to 200L, "event3" to 300L)), 600
            )
        )
        `when`(database.insertBatchedEventIds(any(), any())).thenReturn(true)
        val eventPackets = listOf(
            EventPacket(
                eventId = "event1",
                type = "type1",
                timestamp = 1234567890,
                serializedData = "data1",
                sessionId = "session1",
                serializedAttachments = null,
                serializedDataFilePath = null,
                serializedAttributes = "attributes1"
            ),
        )
        val attachmentPackets = listOf<AttachmentPacket>(
            AttachmentPacket(
                id = "attachment1",
                eventId = "event1",
                type = "type1",
                filePath = "path1",
                name = "name1"
            )
        )
        `when`(database.getEventPackets(any())).thenReturn(eventPackets)
        `when`(database.getAttachmentPackets(any())).thenReturn(attachmentPackets)

        exporter.pulse()
        verify(networkClient).enqueue(eventPackets, attachmentPackets, object : NetworkCallback {
            override fun onSuccess() {}
            override fun onError() {}
        })
    }

    private fun returnEmptyEventsToBatchFromDb() {
        `when`(database.getEventsToBatch(config.maxEventsBatchSize, true)).thenReturn(
            getEmptyBatch()
        )
    }

    private fun getEmptyBatch(): BatchEventEntity {
        return BatchEventEntity(
            LinkedHashMap(), 0
        )
    }
}