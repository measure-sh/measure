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
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import java.time.Duration

class PeriodicEventExporterTest {
    private val logger = NoopLogger()
    private val configProvider = FakeConfigProvider()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
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
        periodicEventExporter.resume()

        verify(heartbeat, atMostOnce()).start(
            configProvider.eventsBatchingIntervalMs,
            configProvider.eventsBatchingIntervalMs,
        )
    }

    @Test
    fun `stops heartbeat when unregistered`() {
        periodicEventExporter.unregister()

        verify(heartbeat).stop()
    }

    @Test
    fun `stops heartbeat when app goes to background`() {
        periodicEventExporter.pause()

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

        periodicEventExporter.pause()

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
        `when`(
            eventExporter.export(
                batch1.first,
                batch1.second,
            ),
        ).thenReturn(HttpResponse.Error.ServerError(500))

        periodicEventExporter.pause()

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
        `when`(
            eventExporter.export(
                batch1.first,
                batch1.second,
            ),
        ).thenReturn(HttpResponse.Error.RateLimitError())

        periodicEventExporter.pause()

        verify(eventExporter).export(batch1.first, batch1.second)
        verify(eventExporter, never()).export(batch2.first, batch2.second)
    }

    @Test
    fun `creates and exports new batch when app goes to background and conditions are met`() {
        // Given no existing batches to export
        `when`(eventExporter.getExistingBatches()).thenReturn(linkedMapOf())
        // Given a new batch is created successfully
        `when`(eventExporter.createBatch()).thenReturn(
            BatchCreationResult("batchId", listOf("event1", "event2")),
        )

        // When
        periodicEventExporter.pause()

        // Then
        verify(eventExporter).export("batchId", listOf("event1", "event2"))
    }

    @Test
    fun `does not export if last batch was created within 30 seconds, when app goes to background`() {
        val initialTime = testClock.epochTime()
        // Given no existing batches to export
        `when`(eventExporter.getExistingBatches()).thenReturn(linkedMapOf())
        periodicEventExporter.lastBatchCreationTimeMs = initialTime

        // Advance time within threshold
        testClock.advance(Duration.ofSeconds(29))

        // When
        periodicEventExporter.pause()

        // Then
        verify(eventExporter, never()).export(any<String>(), any<List<String>>())
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

        periodicEventExporter.pause()

        verify(eventExporter, never()).export(any(), any())
    }
}
