package sh.measure.android.exporter

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Test
import org.mockito.Mockito.atMostOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger

class PeriodicEventExporterTest {
    private val logger = NoopLogger()
    private val configProvider = FakeConfigProvider()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val timeProvider = FakeTimeProvider()
    private val heartbeat = mock<Heartbeat>()
    private val eventExporter = mock<EventExporter>()

    private val periodicEventExporter = PeriodicEventExporterImpl(
        logger,
        configProvider,
        executorService,
        timeProvider,
        heartbeat,
        eventExporter,
    )

    @Test
    fun `adds a listener to heartbeat on initialization`() {
        verify(heartbeat).addListener(periodicEventExporter)
    }

    @Test
    fun `starts heartbeat when app comes to foreground with a delay`() {
        periodicEventExporter.onAppForeground()

        verify(heartbeat, atMostOnce()).start(
            configProvider.eventsBatchingIntervalMs,
            configProvider.eventsBatchingIntervalMs,
        )
    }

    @Test
    fun `starts heartbeat on cold launch with a delay`() {
        periodicEventExporter.onColdLaunch()

        verify(heartbeat, atMostOnce()).start(
            configProvider.eventsBatchingIntervalMs,
            configProvider.eventsBatchingIntervalMs,
        )
    }

    @Test
    fun `stops heartbeat when app goes to background`() {
        periodicEventExporter.onAppBackground()

        verify(heartbeat, atMostOnce()).stop()
    }

    @Test
    fun `exports existing batches, when app goes to background`() {
        val batch1 = "batch1" to mutableListOf("event1, event2")
        val batch2 = "batch2" to mutableListOf("event1, event2")
        val batches = LinkedHashMap<String, MutableList<String>>()
        batches[batch1.first] = batch1.second
        batches[batch2.first] = batch2.second
        `when`(eventExporter.getExistingBatches()).thenReturn(batches)

        periodicEventExporter.onAppBackground()

        verify(eventExporter).export(batch1.first, batch1.second)
        verify(eventExporter).export(batch2.first, batch2.second)
    }

    @Test
    fun `stops exporting existing batches if one of them fails to export due to server error`() {
        val batch1 = "batch1" to mutableListOf("event1, event2")
        val batch2 = "batch2" to mutableListOf("event1, event2")
        val batches = LinkedHashMap<String, MutableList<String>>()
        batches[batch1.first] = batch1.second
        batches[batch2.first] = batch2.second
        `when`(eventExporter.getExistingBatches()).thenReturn(batches)
        `when`(eventExporter.export(batch1.first, batch1.second)).thenReturn(HttpResponse.Error.ServerError())

        periodicEventExporter.onAppBackground()

        verify(eventExporter).export(batch1.first, batch1.second)
        verify(eventExporter, never()).export(batch2.first, batch2.second)
    }

    @Test
    fun `stops exporting existing batches if one of them fails to export due to rate limit error`() {
        val batch1 = "batch1" to mutableListOf("event1, event2")
        val batch2 = "batch2" to mutableListOf("event1, event2")
        val batches = LinkedHashMap<String, MutableList<String>>()
        batches[batch1.first] = batch1.second
        batches[batch2.first] = batch2.second
        `when`(eventExporter.getExistingBatches()).thenReturn(batches)
        `when`(eventExporter.export(batch1.first, batch1.second)).thenReturn(HttpResponse.Error.RateLimitError())

        periodicEventExporter.onAppBackground()

        verify(eventExporter).export(batch1.first, batch1.second)
        verify(eventExporter, never()).export(batch2.first, batch2.second)
    }

    @Test
    fun `given existing batches are not available and last batch was not created recently, creates new batch and exports it, when app goes to background`() {
        timeProvider.fakeUptimeMs = 5000
        periodicEventExporter.lastBatchCreationUptimeMs = 1000
        configProvider.eventsBatchingIntervalMs = 100
        `when`(eventExporter.getExistingBatches()).thenReturn(LinkedHashMap())
        val batchId = "batch1"
        val eventIds = listOf("event1, event2")
        `when`(eventExporter.createBatch()).thenReturn(BatchCreationResult(batchId, eventIds))

        periodicEventExporter.onAppBackground()

        verify(eventExporter).export(batchId, eventIds)
    }

    @Test
    fun `given existing batches are not available and last batch was created recently, does not export, when app goes to background`() {
        timeProvider.fakeCurrentTimeSinceEpochInMillis = 1000
        periodicEventExporter.lastBatchCreationUptimeMs = 1500
        configProvider.eventsBatchingIntervalMs = 5000
        `when`(eventExporter.getExistingBatches()).thenReturn(LinkedHashMap())

        periodicEventExporter.onAppBackground()

        verify(eventExporter, never()).createBatch()
        verify(eventExporter, never()).export(any(), any())
    }

    @Test
    fun `given an export is in progress, does not trigger new export, when app goes to background`() {
        // ensure other conditions for triggering an export are met
        val batch1 = "batch1" to mutableListOf("event1, event2")
        val batches = LinkedHashMap<String, MutableList<String>>()
        batches[batch1.first] = batch1.second
        `when`(eventExporter.getExistingBatches()).thenReturn(batches)

        // forcefully mark an export in progress
        periodicEventExporter.isExportInProgress.set(true)

        periodicEventExporter.onAppBackground()

        verify(eventExporter, never()).export(any(), any())
    }
}
