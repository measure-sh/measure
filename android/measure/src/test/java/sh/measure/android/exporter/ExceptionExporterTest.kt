package sh.measure.android.exporter

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger

class ExceptionExporterTest {
    private val exporter = mock<Exporter>()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val exceptionExporter = ExceptionExporterImpl(
        NoopLogger(),
        exporter,
        executorService,
    )

    @Test
    fun `given a batch is created, exports it`() {
        val batchId = "batch-id"
        val eventIds = listOf("event1", "event2")
        val spanIds = listOf("span1", "span2")
        `when`(exporter.createBatch("session-id")).thenReturn(
            Batch(
                batchId,
                eventIds,
                spanIds,
            ),
        )

        exceptionExporter.export("session-id")

        verify(exporter).export(Batch(batchId, eventIds, spanIds))
    }

    @Test
    fun `given batch is not created, does not trigger export`() {
        `when`(exporter.createBatch("session-id")).thenReturn(null)

        exceptionExporter.export("session-id")

        verify(exporter, never()).export(any())
    }
}
