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

    private val exporter =
        PeriodicEventExporterImpl(logger, config, idProvider, executorService, database, heartbeat)

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
    fun `given events to batch are less than the minimum, does not create a batch`() {
        // MINIMUM_BATCH_SIZE = 3
        val eventIdAttachmentSizeMap = LinkedHashMap<String, Long>()
        eventIdAttachmentSizeMap["event1"] = 100
        eventIdAttachmentSizeMap["event2"] = 200
        `when`(database.getEventsToBatch(config.maxEventsBatchSize, true)).thenReturn(
            BatchEventEntity(
                eventIdAttachmentSizeMap, 300
            )
        )
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