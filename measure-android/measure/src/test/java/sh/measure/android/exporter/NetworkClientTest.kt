package sh.measure.android.exporter

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.storage.FileStorage
import java.io.File

class NetworkClientTest {
    private val mockWebServer = MockWebServer()
    private val fileStorage = mock<FileStorage>()
    private val networkClient: NetworkClient = NetworkClientImpl(
        logger = NoopLogger(),
        fileStorage = fileStorage,
    ).apply {
        init(apiKey = "secret", baseUrl = "http://localhost:8080")
    }
    private val fakeFile =
        File.createTempFile("file", "txt").apply { writeText(getFakeFileContent()) }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
        fakeFile.deleteOnExit()
    }

    @Test
    fun `creates a request, sends it to events endpoint and returns success`() {
        // Given
        val batchId = "batchId"
        val eventEntity = TestData.fakeEventEntity(eventId = "event-")
        val eventPacket = TestData.getEventPacket(eventEntity)
        val attachmentPackets = TestData.getAttachmentPackets(eventEntity)
        attachmentPackets.forEach {
            `when`(fileStorage.getFile(it.filePath)).thenReturn(fakeFile)
        }

        mockWebServer.enqueue(MockResponse().setResponseCode(202))
        mockWebServer.start(port = 8080)

        // When
        val result = networkClient.execute(batchId, listOf(eventPacket), attachmentPackets)
        val recordedRequest = mockWebServer.takeRequest()

        // Assert
        assertTrue(result is HttpResponse.Success)
        assertEquals("PUT", recordedRequest.method)
    }

    @Test
    fun `creates a request with request ID header`() {
        // Given
        val batchId = "batchId"
        val eventEntity = TestData.fakeEventEntity(eventId = "event-")
        val eventPacket = TestData.getEventPacket(eventEntity)
        val attachmentPackets = TestData.getAttachmentPackets(eventEntity)
        attachmentPackets.forEach {
            `when`(fileStorage.getFile(it.filePath)).thenReturn(fakeFile)
        }

        mockWebServer.enqueue(MockResponse().setResponseCode(202))
        mockWebServer.start(port = 8080)

        // When
        networkClient.execute(batchId, listOf(eventPacket), attachmentPackets)
        val recordedRequest = mockWebServer.takeRequest()

        // Assert
        assertTrue(recordedRequest.headers.contains(Pair("msr-req-id", batchId)))
    }

    @Test
    fun `creates a request, sends it to events endpoint and returns error if request fails due to server error`() {
        // Given
        val batchId = "batchId"
        val eventEntity = TestData.fakeEventEntity(eventId = "event-")
        val eventPacket = TestData.getEventPacket(eventEntity)
        val attachmentPackets = TestData.getAttachmentPackets(eventEntity)
        attachmentPackets.forEach {
            `when`(fileStorage.getFile(it.filePath)).thenReturn(fakeFile)
        }

        mockWebServer.enqueue(MockResponse().setResponseCode(500))
        mockWebServer.start(port = 8080)

        // When
        val result = networkClient.execute(batchId, listOf(eventPacket), attachmentPackets)

        // Assert
        assertTrue(result is HttpResponse.Error.ServerError)
    }

    @Test
    fun `creates a request, sends it to events endpoint and returns error if request fails due to client error`() {
        // Given
        val batchId = "batchId"
        val eventEntity = TestData.fakeEventEntity(eventId = "event-")
        val eventPacket = TestData.getEventPacket(eventEntity)
        val attachmentPackets = TestData.getAttachmentPackets(eventEntity)
        attachmentPackets.forEach {
            `when`(fileStorage.getFile(it.filePath)).thenReturn(fakeFile)
        }

        mockWebServer.enqueue(MockResponse().setResponseCode(404))
        mockWebServer.start(port = 8080)

        // When
        val result = networkClient.execute(batchId, listOf(eventPacket), attachmentPackets)

        // Assert
        assertTrue(result is HttpResponse.Error.ClientError)
    }

    @Test
    fun `creates a request, sends it to events endpoint and returns error if request fails due to rate limit error`() {
        // Given
        val batchId = "batchId"
        val eventEntity = TestData.fakeEventEntity(eventId = "event-")
        val eventPacket = TestData.getEventPacket(eventEntity)
        val attachmentPackets = TestData.getAttachmentPackets(eventEntity)
        attachmentPackets.forEach {
            `when`(fileStorage.getFile(it.filePath)).thenReturn(fakeFile)
        }

        mockWebServer.enqueue(MockResponse().setResponseCode(429))
        mockWebServer.start(port = 8080)

        // When
        val result = networkClient.execute(batchId, listOf(eventPacket), attachmentPackets)

        // Assert
        assertTrue(result is HttpResponse.Error.RateLimitError)
    }

    @Test
    fun `given event data is in serialized data, request form data for event is valid`() {
        val eventEntity = TestData.fakeEventEntity(eventId = "event-id")
        val eventPacket = TestData.getEventPacket(eventEntity)

        val formDataPart = eventPacket.asFormDataPart(fileStorage)

        val expectedData =
            "{\"id\":\"${eventEntity.id}\",\"session_id\":\"${eventEntity.sessionId}\",\"user_triggered\":${eventEntity.userTriggered},\"timestamp\":\"${eventEntity.timestamp}\",\"type\":\"${eventEntity.type}\",\"${eventEntity.type}\":serialized-data,\"attachments\":${eventEntity.serializedAttachments},\"attribute\":${eventEntity.serializedAttributes}}"
        assertEquals(expectedData, formDataPart)
    }

    @Test
    fun `given event data is in file, request form data for event is valid`() {
        val eventEntity = TestData.fakeEventEntity(eventId = "event-id")
        val eventPacket = TestData.getEventPacket(eventEntity)

        val formDataPart = eventPacket.asFormDataPart(fileStorage)

        val expectedData =
            "{\"id\":\"${eventEntity.id}\",\"session_id\":\"${eventEntity.sessionId}\",\"user_triggered\":${eventEntity.userTriggered},\"timestamp\":\"${eventEntity.timestamp}\",\"type\":\"${eventEntity.type}\",\"${eventEntity.type}\":serialized-data,\"attachments\":${eventEntity.serializedAttachments},\"attribute\":${eventEntity.serializedAttributes}}"
        assertEquals(expectedData, formDataPart)
    }

    private fun getFakeFileContent(): String {
        return "lorem ipsum dolor sit amet"
    }
}
