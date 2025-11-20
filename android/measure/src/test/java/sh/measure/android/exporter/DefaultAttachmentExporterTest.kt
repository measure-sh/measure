package sh.measure.android.exporter

import android.content.ContentValues
import android.os.Build
import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.events.AttachmentType
import sh.measure.android.fakes.FakeRandomizer
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.AttachmentV1Table
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.storage.FileStorageImpl
import sh.measure.android.storage.SessionEntity

// This test uses robolectric and a real instance of database.
@RunWith(AndroidJUnit4::class)
class DefaultAttachmentExporterTest {
    private val logger = NoopLogger()
    private val mockWebServer: MockWebServer = MockWebServer()
    private val context =
        InstrumentationRegistry.getInstrumentation().targetContext.applicationContext
    private val database = DatabaseImpl(context, logger)
    private val rootDir = context.filesDir.path
    private val fileStorage = FileStorageImpl(rootDir, logger)
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val randomizer = FakeRandomizer()
    private val fakeSleeper = FakeSleeper()
    private val httpClient = HttpUrlConnectionClient(logger)
    private val exporter = DefaultAttachmentExporter(
        fileStorage = fileStorage,
        database = database,
        logger = logger,
        randomizer = randomizer,
        executorService = executorService,
        httpClient = httpClient,
        sleeper = fakeSleeper,
    )

    @Before
    fun setup() {
        mockWebServer.start()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `on attachment upload success, deletes it from storage`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        writeAttachment(
            sessionId = "session-id",
            eventId = "event-1",
            attachmentId = "attachment-1",
            bytes = "attachment".toByteArray(),
        )
        exporter.register()
        Assert.assertEquals(1, mockWebServer.requestCount)

        // Deletes from db
        val remaining = database.getAttachmentsToUpload(100, listOf()).size
        Assert.assertEquals(0, remaining)

        // Deletes from file storage
        val files = fileStorage.getAllFiles()
        Assert.assertEquals(0, files.size)
    }

    @Test
    fun `when attachment upload fails, cancels the export`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(500))

        writeAttachment(
            sessionId = "session-id",
            eventId = "event-2",
            attachmentId = "attachment-2",
            bytes = "attachment".toByteArray(),
        )
        writeAttachment(
            sessionId = "session-id",
            eventId = "event-3",
            attachmentId = "attachment-3",
            bytes = "attachment".toByteArray(),
        )

        exporter.register()
        Assert.assertEquals(1, mockWebServer.requestCount)

        val remaining = database.getAttachmentsToUpload(100, listOf()).size
        Assert.assertEquals(2, remaining)

        val files = fileStorage.getAllFiles()
        Assert.assertEquals(2, files.size)
    }

    @Test
    fun `when attachment upload fails with a client error, deletes it from storage`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(400))
        writeAttachment(
            sessionId = "session-id",
            eventId = "event-1",
            attachmentId = "attachment-1",
            bytes = "attachment".toByteArray(),
        )
        exporter.register()

        Assert.assertEquals(1, mockWebServer.requestCount)
        val remaining = database.getAttachmentsToUpload(100, listOf()).size
        Assert.assertEquals(0, remaining)
    }

    @Test
    fun `uploads multiple attachments until one fails`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        mockWebServer.enqueue(MockResponse().setResponseCode(500))

        writeAttachment(
            sessionId = "session-id",
            eventId = "event-1",
            attachmentId = "attachment-1",
            bytes = "attachment".toByteArray(),
        )
        writeAttachment(
            sessionId = "session-id",
            eventId = "event-2",
            attachmentId = "attachment-2",
            bytes = "attachment".toByteArray(),
        )
        writeAttachment(
            sessionId = "session-id",
            eventId = "event-3",
            attachmentId = "attachment-3",
            bytes = "attachment".toByteArray(),
        )
        writeAttachment(
            sessionId = "session-id",
            eventId = "event-4",
            attachmentId = "attachment-4",
            bytes = "attachment".toByteArray(),
        )

        exporter.register()

        Assert.assertEquals(3, mockWebServer.requestCount)

        val remaining = database.getAttachmentsToUpload(100, listOf()).size
        Assert.assertEquals(2, remaining)

        val files = fileStorage.getAllFiles()
        Assert.assertEquals(2, files.size)
    }

    @Test
    fun `sets correct content type when uploading attachments`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        writeAttachment(
            sessionId = "session-id",
            eventId = "event-1",
            attachmentId = "attachment-1",
            bytes = "attachment".toByteArray(),
            name = "attachment-1.webp",
            type = AttachmentType.SCREENSHOT,
        )

        writeAttachment(
            sessionId = "session-id",
            eventId = "event-2",
            attachmentId = "attachment-2",
            bytes = "attachment".toByteArray(),
            name = "attachment-2.svg",
            type = AttachmentType.LAYOUT_SNAPSHOT,
        )

        writeAttachment(
            sessionId = "session-id",
            eventId = "event-3",
            attachmentId = "attachment-3",
            bytes = "attachment".toByteArray(),
            name = "attachment-3.jpeg",
            type = AttachmentType.SCREENSHOT,
        )

        exporter.register()

        Assert.assertEquals(3, mockWebServer.requestCount)
        val request1 = mockWebServer.takeRequest()
        Assert.assertEquals("image/webp", request1.getHeader("Content-Type"))
        val request2 = mockWebServer.takeRequest()
        Assert.assertEquals("image/svg+xml", request2.getHeader("Content-Type"))
        val request3 = mockWebServer.takeRequest()
        Assert.assertEquals("image/jpeg", request3.getHeader("Content-Type"))
    }

    private fun writeAttachment(
        sessionId: String,
        eventId: String,
        attachmentId: String,
        bytes: ByteArray,
        name: String = "attachment-1",
        type: String = AttachmentType.LAYOUT_SNAPSHOT,
        hasUrl: Boolean = true,
    ) {
        insertSessionInDb("session-id")
        val path = fileStorage.writeAttachment(attachmentId = attachmentId, bytes = bytes)
        val attachmentValues = ContentValues().apply {
            put(AttachmentV1Table.COL_ID, attachmentId)
            put(AttachmentV1Table.COL_EVENT_ID, eventId)
            put(AttachmentV1Table.COL_TYPE, type)
            put(AttachmentV1Table.COL_TIMESTAMP, "")
            put(AttachmentV1Table.COL_SESSION_ID, sessionId)
            put(AttachmentV1Table.COL_FILE_PATH, path)
            put(AttachmentV1Table.COL_NAME, name)
            put(
                AttachmentV1Table.COL_UPLOAD_URL,
                if (hasUrl) mockWebServer.url("/").toString() else null,
            )
            put(AttachmentV1Table.COL_URL_EXPIRES_AT, "")
            put(AttachmentV1Table.COL_URL_HEADERS, "{}")
        }
        database.writableDatabase.insert(AttachmentV1Table.TABLE_NAME, null, attachmentValues)
    }

    private fun insertSessionInDb(@Suppress("SameParameterValue") sessionId: String) {
        database.insertSession(
            SessionEntity(
                sessionId,
                12345,
                12345,
                needsReporting = false,
                supportsAppExit = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
                appVersion = "1.0.0",
                appBuild = "100",
            ),
        )
    }
}
