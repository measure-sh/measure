package sh.measure.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DefaultConfigTest {

    private val config = DefaultConfig()

    @Test
    fun `returns true for a allowed URL and content type`() {
        val url = "https://example.com/"
        val contentType = "application/json"
        assertTrue(config.trackHttpBody(url, contentType))
    }

    @Test
    fun `returns false for a disallowed URL`() {
        val url = "10.0.2.2:8080/sessions"
        val contentType = "application/json"
        assertFalse(config.trackHttpBody(url, contentType))
    }

    @Test
    fun `returns false for a disallowed content type`() {
        val url = "https://example.com/"
        val contentType = "text/plain"
        assertFalse(config.trackHttpBody(url, contentType))
    }

    @Test
    fun `returns false for a disallowed URL and content type`() {
        val url = "10.0.2.2:8080/sessions/sessions"
        val contentType = "text/plain"
        assertFalse(config.trackHttpBody(url, contentType))
    }
}
