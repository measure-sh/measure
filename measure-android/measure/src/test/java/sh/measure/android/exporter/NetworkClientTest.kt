package sh.measure.android.exporter

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.FileStorage
import java.io.File

class NetworkClientTest {
    private val mockWebServer = MockWebServer()
    private val fileStorage = mock<FileStorage>()
    private val networkClient: NetworkClient = NetworkClientImpl(
        logger = NoopLogger(),
        secretToken = "secret",
        baseUrl = "http://localhost:8080",
        fileStorage = fileStorage,
    )
    private val fakeFile = File.createTempFile("file", "txt").apply { writeText(getFakeFileContent()) }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
        fakeFile.deleteOnExit()
    }

    @Test
    fun `creates a request, sends it to events endpoint and returns true if success`() {
        // Given
        val batchId = "batchId"
        val eventEntity = FakeEventFactory.fakeEventEntity(eventId = "event-")
        val eventPacket = FakeEventFactory.getEventPacket(eventEntity)
        val attachmentPackets = FakeEventFactory.getAttachmentPackets(eventEntity)
        attachmentPackets.forEach {
            `when`(fileStorage.getFile(it.filePath)).thenReturn(fakeFile)
        }

        mockWebServer.enqueue(MockResponse().setResponseCode(202))
        mockWebServer.start(port = 8080)

        // When
        val result = networkClient.execute(batchId, listOf(eventPacket), attachmentPackets)
        val recordedRequest = mockWebServer.takeRequest()

        // Assert
        assertTrue(result)
        assertEquals("PUT", recordedRequest.method)
        assertTrue(recordedRequest.headers.contains(Pair("msr-request-id", batchId)))
    }

    @Test
    fun `creates a request, sends it to events endpoint and returns false if request fails`() {
        // Given
        val batchId = "batchId"
        val eventEntity = FakeEventFactory.fakeEventEntity(eventId = "event-")
        val eventPacket = FakeEventFactory.getEventPacket(eventEntity)
        val attachmentPackets = FakeEventFactory.getAttachmentPackets(eventEntity)
        attachmentPackets.forEach {
            `when`(fileStorage.getFile(it.filePath)).thenReturn(fakeFile)
        }

        mockWebServer.enqueue(MockResponse().setResponseCode(500))
        mockWebServer.start(port = 8080)

        // When
        val result = networkClient.execute(batchId, listOf(eventPacket), attachmentPackets)
        val recordedRequest = mockWebServer.takeRequest()

        // Assert
        assertFalse(result)
        assertEquals("PUT", recordedRequest.method)
        assertTrue(recordedRequest.headers.contains(Pair("msr-request-id", batchId)))
    }

    private fun getFakeFileContent(): String {
        return "lorem ipsum dolor sit amet"
    }
}
