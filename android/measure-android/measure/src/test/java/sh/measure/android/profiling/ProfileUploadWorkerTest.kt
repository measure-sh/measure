package sh.measure.android.profiling

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker
import androidx.work.testing.TestWorkerBuilder
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okio.GzipSource
import okio.buffer
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.events.AttachmentType
import sh.measure.android.exporter.SignedAttachment
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.storage.DatabaseImpl
import java.io.File
import java.util.concurrent.Executors

@RunWith(AndroidJUnit4::class)
internal class ProfileUploadWorkerTest {
    private val context =
        InstrumentationRegistry.getInstrumentation().targetContext.applicationContext
    private val database = DatabaseImpl(context, NoopLogger())
    private val mockWebServer = MockWebServer()

    @Before
    fun setup() {
        mockWebServer.start()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
        database.close()
    }

    @Test
    fun `uploads profile gzip-compressed and deletes the row on success`() {
        val original = "profile-bytes-".repeat(64).toByteArray()
        val file = insertPendingProfile("profile-1", original)
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        val result = runWorker()

        assertEquals(ListenableWorker.Result.success(), result)
        val request = mockWebServer.takeRequest()
        assertEquals("PUT", request.method)
        assertEquals("gzip", request.headers["Content-Encoding"])
        val uploaded = GzipSource(request.body).buffer().use { it.readByteArray() }
        assertArrayEquals(original, uploaded)
        assertTrue(database.getProfileAttachmentsToUpload(10).isEmpty())
        assertTrue("the platform-owned file must not be deleted", file.exists())
    }

    @Test
    fun `keeps the row and retries on a server error`() {
        val file = insertPendingProfile("profile-1", "bytes".toByteArray())
        mockWebServer.enqueue(MockResponse().setResponseCode(500))

        val result = runWorker()

        assertEquals(ListenableWorker.Result.retry(), result)
        assertEquals(listOf("profile-1"), database.getProfileAttachmentsToUpload(10).map { it.id })
        assertTrue(file.exists())
    }

    @Test
    fun `drops the row on a client error`() {
        insertPendingProfile("profile-1", "bytes".toByteArray())
        mockWebServer.enqueue(MockResponse().setResponseCode(404))

        val result = runWorker()

        assertEquals(ListenableWorker.Result.success(), result)
        assertTrue(database.getProfileAttachmentsToUpload(10).isEmpty())
    }

    @Test
    fun `drops the row without uploading when the file is missing`() {
        val missingPath = File(context.cacheDir, "does-not-exist.perfetto-trace").absolutePath
        insertPendingProfile("profile-1", bytes = null, path = missingPath)

        val result = runWorker()

        assertEquals(ListenableWorker.Result.success(), result)
        assertTrue(database.getProfileAttachmentsToUpload(10).isEmpty())
        assertEquals(0, mockWebServer.requestCount)
    }

    @Test
    fun `uploads every pending profile`() {
        repeat(3) { index ->
            insertPendingProfile("profile-$index", "bytes-$index".toByteArray())
            mockWebServer.enqueue(MockResponse().setResponseCode(200))
        }

        val result = runWorker()

        assertEquals(ListenableWorker.Result.success(), result)
        assertTrue(database.getProfileAttachmentsToUpload(10).isEmpty())
        assertEquals(3, mockWebServer.requestCount)
    }

    @Test
    fun `succeeds when nothing is pending`() {
        val result = runWorker()

        assertEquals(ListenableWorker.Result.success(), result)
        assertEquals(0, mockWebServer.requestCount)
    }

    private fun runWorker(): ListenableWorker.Result {
        val worker = TestWorkerBuilder.from(
            context,
            ProfileUploadWorker::class.java,
            Executors.newSingleThreadExecutor(),
        ).build()
        return worker.doWork()
    }

    /**
     * Inserts a signed profile attachment pointing at a real file (unless [path] is given), and
     * returns that file. The upload URL points at [mockWebServer].
     */
    private fun insertPendingProfile(
        id: String,
        bytes: ByteArray?,
        path: String? = null,
    ): File {
        val file = File.createTempFile(id, ".perfetto-trace", context.cacheDir)
        if (bytes != null) {
            file.writeBytes(bytes)
        }
        database.insertSession(TestData.getSessionEntity(id = "session-$id"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-$id",
                sessionId = "session-$id",
                attachmentEntities = listOf(
                    TestData.getAttachmentEntity(
                        id = id,
                        type = AttachmentType.PERFETTO_TRACE,
                        path = path ?: file.absolutePath,
                    ),
                ),
            ),
        )
        database.updateAttachmentUrls(
            listOf(
                SignedAttachment(
                    id = id,
                    type = AttachmentType.PERFETTO_TRACE,
                    filename = "$id.perfetto-trace",
                    uploadUrl = mockWebServer.url("/$id").toString(),
                    expiresAt = "2099-01-15T10:00:00.000Z",
                    headers = emptyMap(),
                ),
            ),
        )
        return file
    }
}
