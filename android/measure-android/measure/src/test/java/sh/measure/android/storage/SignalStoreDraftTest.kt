package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent

@RunWith(AndroidJUnit4::class)
internal class SignalStoreDraftTest {
    private val fileStorage = mock<FileStorage>()
    private val database = mock<Database>()

    private val signalStore: SignalStore = SignalStoreImpl(
        NoopLogger(),
        fileStorage,
        database,
        FakeIdProvider(),
        FakeConfigProvider(),
    )

    @Test
    fun `stores a draft event as a draft`() {
        val event = TestData.getExceptionData().toEvent(type = EventType.ANR, isDraft = true)

        assertTrue(store(event).isDraft)
    }

    @Test
    fun `stores every other event ready to export`() {
        val event = TestData.getExceptionData().toEvent(type = EventType.ANR)

        assertFalse(store(event).isDraft)
    }

    private fun <T> store(event: Event<T>): EventEntity {
        `when`(fileStorage.writeEventData(any(), any())).thenReturn("fake-file-path")
        val eventsCaptor = argumentCaptor<EventEntity>()

        signalStore.store(event)

        verify(database).insertEvent(eventsCaptor.capture())
        return eventsCaptor.firstValue
    }
}
