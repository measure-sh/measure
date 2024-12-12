package sh.measure.android.exporter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.Database
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock

class BatchCreatorTest {
    private val database = mock<Database>()
    private val config = FakeConfigProvider()
    private val batchCreator = BatchCreatorImpl(
        logger = NoopLogger(),
        idProvider = FakeIdProvider(),
        database = database,
        configProvider = config,
        timeProvider = AndroidTimeProvider(TestClock.create()),
    )

    @Test
    fun `respects max attachment size when creating a batch`() {
        // Given
        config.maxEventsInBatch = 100
        config.maxAttachmentSizeInEventsBatchInBytes = 500
        `when`(
            database.getUnBatchedEventsWithAttachmentSize(
                any(),
                eq(true),
                eq(null),
                eq(config.eventTypeExportAllowList),
            ),
        ).thenReturn(
            LinkedHashMap<String, Long>().apply {
                put("event1", 100)
                put("event2", 200)
                put("event3", 300)
            },
        )
        `when`(database.insertBatch(any())).thenReturn(true)

        // When
        val result = batchCreator.create()

        // Then
        assertEquals(2, result?.eventIds?.size)
    }

    @Test
    fun `returns null if no events and spans to batch`() {
        // Given
        `when`(
            database.getUnBatchedEventsWithAttachmentSize(
                eventCount = any(),
                ascending = eq(true),
                sessionId = eq(null),
                eventTypeExportAllowList = eq(config.eventTypeExportAllowList),
            ),
        ).thenReturn(
            LinkedHashMap(),
        )
        `when`(
            database.getUnBatchedSpans(
                spanCount = any(),
                ascending = eq(true),
            ),
        ).thenReturn(
            listOf(),
        )

        // When
        val result = batchCreator.create()

        // Then
        assertNull(result)
    }
}
