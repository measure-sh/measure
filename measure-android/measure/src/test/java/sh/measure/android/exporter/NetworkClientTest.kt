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
        assertTrue(recordedRequest.headers.contains(Pair("msr-req-id", batchId)))
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
        assertTrue(recordedRequest.headers.contains(Pair("msr-req-id", batchId)))
    }

    @Test
    fun `given event data is in serialized data, request form data for event is valid`() {
        val eventEntity = FakeEventFactory.fakeEventEntity(eventId = "event-id")
        val eventPacket = FakeEventFactory.getEventPacket(eventEntity)

        val formDataPart = eventPacket.asFormDataPart(fileStorage)

        val expectedData =
            "{\"id\":\"${eventEntity.id}\",\"session_id\":\"${eventEntity.sessionId}\",\"timestamp\":\"${eventEntity.timestamp}\",\"type\":\"${eventEntity.type}\",\"${eventEntity.type}\":serialized-data,\"attachments\":${eventEntity.serializedAttachments},\"attribute\":${eventEntity.serializedAttributes}}"
        assertEquals(expectedData, formDataPart)
    }

    @Test
    fun `given event data is in file, request form data for event is valid`() {
        val eventEntity = FakeEventFactory.fakeEventEntity(eventId = "event-id")
        val eventPacket = FakeEventFactory.getEventPacket(eventEntity)

        val formDataPart = eventPacket.asFormDataPart(fileStorage)

        val expectedData =
            "{\"id\":\"${eventEntity.id}\",\"session_id\":\"${eventEntity.sessionId}\",\"timestamp\":\"${eventEntity.timestamp}\",\"type\":\"${eventEntity.type}\",\"${eventEntity.type}\":serialized-data,\"attachments\":${eventEntity.serializedAttachments},\"attribute\":${eventEntity.serializedAttributes}}"
        assertEquals(expectedData, formDataPart)
    }

    private fun getFakeFileContent(): String {
        return "lorem ipsum dolor sit amet"
    }
}
