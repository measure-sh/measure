package sh.measure.android.exporter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.Mockito.eq
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import sh.measure.android.fakes.FakeConfig
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.Database

class BatchCreatorTest {
    private val database = mock<Database>()
    private val config = FakeConfig()
    private val batchCreator = BatchCreatorImpl(
        logger = NoopLogger(),
        idProvider = FakeIdProvider(),
        database = database,
        config = config,
        timeProvider = FakeTimeProvider()
    )

    @Test
    fun `respects max attachment size when creating a batch`() {
        // Given
        config.maxAttachmentSizeInBytes = 500
        config.maxEventsBatchSize = 100
        `when`(database.getUnBatchedEventsWithAttachmentSize(any(), eq(true))).thenReturn(
            LinkedHashMap<String, Long>().apply {
                put("event1", 100)
                put("event2", 200)
                put("event3", 300)
            })
        `when`(database.insertBatch(any(), any(), any())).thenReturn(true)

        // When
        val result = batchCreator.create()

        // Then
        assertEquals(2, result?.eventIds?.size)
    }

    @Test
    fun `returns null if no events to batch`() {
        // Given
        `when`(database.getUnBatchedEventsWithAttachmentSize(any(), eq(true))).thenReturn(
            LinkedHashMap()
        )

        // When
        val result = batchCreator.create()

        // Then
        assertNull(result)
    }
}