package sh.measure.android.storage

import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.robolectric.annotation.Config
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent

/**
 * Where an ANR is stored depends on the platform version, so these run
 * under Robolectric with the SDK pinned either side of the split.
 */
@RunWith(AndroidJUnit4::class)
internal class SignalStoreAnrTest {
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
    @Config(sdk = [Build.VERSION_CODES.R])
    fun `holds an ANR in the pending ANRs table on API 30 and above`() {
        val event = TestData.getExceptionData().toEvent(type = EventType.ANR)
        `when`(fileStorage.writeEventData(any(), any())).thenReturn("fake-file-path")

        signalStore.store(event)

        verify(database).insertPendingAnr(any())
        verify(database, never()).insertEvent(any())
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.Q])
    fun `stores an ANR in the events table below API 30`() {
        val event = TestData.getExceptionData().toEvent(type = EventType.ANR)
        val eventsCaptor = argumentCaptor<EventEntity>()
        `when`(fileStorage.writeEventData(any(), any())).thenReturn("fake-file-path")

        signalStore.store(event)

        verify(fileStorage).writeEventData(event.id, event.serializeDataToString())
        verify(database).insertEvent(eventsCaptor.capture())
        verify(database, never()).insertPendingAnr(any())
        assertEquals("fake-file-path", eventsCaptor.firstValue.filePath)
    }
}
