package sh.measure.android.storage

import org.junit.Assert.assertThrows
import org.junit.Test

class EventEntityTest {

    @Test
    fun `throws exception when both filePath and serializedData are null`() {
        assertThrows(IllegalArgumentException::class.java) {
            EventEntity(
                id = "event-id",
                type = "test",
                timestamp = "2024-03-18T12:50:12.62600000Z",
                sessionId = "987",
                userTriggered = false,
                attachmentEntities = emptyList(),
                serializedAttributes = null,
                attachmentsSize = 0,
                serializedUserDefAttributes = null,
            )
        }
    }

    @Test
    fun `throws exception when both filePath and serializedData are set`() {
        assertThrows(IllegalArgumentException::class.java) {
            EventEntity(
                id = "event-id",
                type = "test",
                timestamp = "2024-03-18T12:50:12.62600000Z",
                sessionId = "987",
                userTriggered = false,
                filePath = "test-file-path",
                serializedData = "test-data",
                attachmentEntities = emptyList(),
                serializedAttributes = null,
                attachmentsSize = 0,
                serializedUserDefAttributes = null,
            )
        }
    }
}
