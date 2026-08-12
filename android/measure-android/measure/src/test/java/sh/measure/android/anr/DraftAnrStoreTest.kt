package sh.measure.android.anr

import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.Database
import sh.measure.android.storage.DraftAnr
import sh.measure.android.storage.FileStorage
import java.io.File

class DraftAnrStoreTest {
    private val database = mock<Database>()
    private val fileStorage = mock<FileStorage>()

    @get:Rule
    val temporaryFolder = TemporaryFolder()

    private val draftAnrStore = DraftAnrStoreImpl(NoopLogger(), database, fileStorage)

    @Test
    fun `merges the thread dump and subject into the stored body`() {
        val body = writeAnrBody("event-id-1")

        draftAnrStore.mergeThreadDump(
            draftAnr(body),
            "DALVIK THREADS (1):",
            "Input dispatching timed out",
        )

        val merged = readAnrBody(body)
        assertEquals("DALVIK THREADS (1):", merged.art_thread_dump)
        assertEquals("Input dispatching timed out", merged.subject)
    }

    @Test
    fun `leaves the rest of the stored body untouched`() {
        val body = writeAnrBody("event-id-1")
        val original = readAnrBody(body)

        draftAnrStore.mergeThreadDump(draftAnr(body), "DALVIK THREADS (1):", null)

        val merged = readAnrBody(body)
        assertEquals(original.exceptions, merged.exceptions)
        assertEquals(original.threads, merged.threads)
        assertEquals(original.foreground, merged.foreground)
        assertEquals(null, merged.subject)
    }

    @Test
    fun `keeps the stored body when it cannot be read`() {
        val body = temporaryFolder.newFile("event-id-1")
        body.writeText("not json")
        whenever(fileStorage.getFile(body.path)).thenReturn(body)

        draftAnrStore.mergeThreadDump(draftAnr(body), "DALVIK THREADS (1):", null)

        assertEquals("not json", body.readText())
    }

    @Test
    fun `does nothing when the body file is missing`() {
        val draftAnr = DraftAnr("event-id-1", "2026-07-31T10:00:00.00000000Z", "gone", 1)
        whenever(fileStorage.getFile("gone")).thenReturn(null)

        draftAnrStore.mergeThreadDump(draftAnr, "DALVIK THREADS (1):", null)
    }

    @Test
    fun `releases the anrs held by processes other than the current one`() {
        draftAnrStore.finalize(999)

        verify(database).finalizeDrafts(999)
    }

    private fun draftAnr(body: File) = DraftAnr(
        "event-id-1",
        "2026-07-31T10:00:00.00000000Z",
        body.path,
        1,
    )

    private fun writeAnrBody(eventId: String): File {
        val file = temporaryFolder.newFile(eventId)
        file.writeText(
            jsonSerializer.encodeToString(
                ExceptionData.serializer(),
                TestData.getExceptionData(),
            ),
        )
        whenever(fileStorage.getFile(file.path)).thenReturn(file)
        return file
    }

    private fun readAnrBody(file: File): ExceptionData = jsonSerializer.decodeFromString(ExceptionData.serializer(), file.readText())
}
