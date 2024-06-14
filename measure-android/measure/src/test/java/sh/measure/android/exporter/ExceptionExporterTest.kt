package sh.measure.android.exporter

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.fakes.ImmediateExecutorService

class ExceptionExporterTest {
    private val eventExporter = mock<EventExporter>()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val exceptionExporter = ExceptionExporterImpl(
        eventExporter,
        executorService,
    )

    @Test
    fun `given a batch is created, exports it`() {
        val batchId = "batch-id"
        val eventIds = listOf("event1", "event2")
        `when`(eventExporter.createBatch()).thenReturn(BatchCreationResult(batchId, eventIds))

        exceptionExporter.export()

        verify(eventExporter).export(batchId, eventIds)
    }

    @Test
    fun `given batch is not created, does not trigger export`() {
        `when`(eventExporter.createBatch()).thenReturn(null)

        exceptionExporter.export()

        verify(eventExporter, never()).export(any(), any())
    }
}
