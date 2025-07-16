package sh.measure.android.config

import junit.framework.TestCase.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ClientInfoTest {

    @Test
    fun `fromJson returns ClientInfo when apiKey and apiUrl are provided`() {
        val json = mapOf(
            "apiKey" to "abc123",
            "apiUrl" to "https://custom.example.com",
        )

        val result = ClientInfo.fromJson(json)

        assertEquals("abc123", result.apiKey)
        assertEquals("https://custom.example.com", result.apiUrl)
    }

    @Test
    fun `fromJson uses default apiUrl when not provided`() {
        val json = mapOf("apiKey" to "abc123")

        val result = ClientInfo.fromJson(json)

        assertEquals("abc123", result.apiKey)
        assertEquals(MEASURE_API_URL, result.apiUrl)
    }

    @Test
    fun `fromJson throws when apiKey is missing`() {
        val json = mapOf("apiUrl" to "https://custom.example.com")

        val exception = assertThrows(IllegalArgumentException::class.java) {
            ClientInfo.fromJson(json)
        }

        assertEquals("apiKey is mandatory", exception.message)
    }

    @Test
    fun `fromJson throws when apiKey is empty`() {
        val json = mapOf(
            "apiKey" to "",
            "apiUrl" to "https://custom.example.com",
        )

        val exception = assertThrows(IllegalArgumentException::class.java) {
            ClientInfo.fromJson(json)
        }

        assertEquals("apiKey is mandatory", exception.message)
    }
}
