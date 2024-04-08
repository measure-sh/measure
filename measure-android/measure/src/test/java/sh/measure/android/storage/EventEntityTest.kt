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
                timestamp = 1234567890L,
                sessionId = "987",
                attachmentEntities = emptyList()
            )
        }
    }

    @Test
    fun `throws exception when both filePath and serializedData are set`() {
        assertThrows(IllegalArgumentException::class.java) {
            EventEntity(
                id = "event-id",
                type = "test",
                timestamp = 1234567890L,
                sessionId = "987",
                filePath = "test-file-path",
                serializedData = "test-data",
                attachmentEntities = emptyList()
            )
        }
    }
}