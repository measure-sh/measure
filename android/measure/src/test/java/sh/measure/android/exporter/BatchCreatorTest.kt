package sh.measure.android.exporter

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
    fun `returns null if no events and spans to batch`() {
        // Given
        `when`(
            database.getUnBatchedEvents(
                eventCount = any(),
                ascending = eq(true),
                sessionId = eq(null),
                eventTypeExportAllowList = eq(config.eventTypeExportAllowList),
            ),
        ).thenReturn(
            listOf(),
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
