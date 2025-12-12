package sh.measure.android.config

import org.junit.Assert
import org.junit.Test

class ConfigProviderTest {
    private val defaultConfig = Config()
    private val configProvider = ConfigProviderImpl(defaultConfig = defaultConfig)

    @Test
    fun `shouldTrackHttpBody returns false if trackHttpBody is set to false`() {
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(
                trackHttpBody = false,
                httpUrlAllowlist = listOf("example.com"),
            ),
        )
        Assert.assertFalse(configProvider.shouldTrackHttpBody("example.com", "application/json"))
    }

    @Test
    fun `shouldTrackHttpBody returns true for a URL not blocked and allowed content type`() {
        val contentType = "application/json"
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(trackHttpBody = true, httpUrlBlocklist = listOf("allowed.com")),
        )
        Assert.assertTrue(configProvider.shouldTrackHttpBody("example.com", contentType))
    }

    @Test
    fun `shouldTrackHttpBody returns true for a allowed URL and content type`() {
        val contentType = "application/json"
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(trackHttpBody = true, httpUrlAllowlist = listOf("allowed.com")),
        )
        Assert.assertTrue(configProvider.shouldTrackHttpBody("allowed.com", contentType))
    }

    @Test
    fun `shouldTrackHttpBody returns false for a blocked URL`() {
        val url = "example.com"
        val contentType = "application/json"
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(httpUrlBlocklist = listOf("example.com")),
        )
        Assert.assertFalse(configProvider.shouldTrackHttpBody(url, contentType))
    }

    @Test
    fun `shouldTrackHttpBody returns false URL not part of allowList`() {
        val contentType = "application/json"
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(httpUrlAllowlist = listOf("allowed.com")),
        )
        Assert.assertFalse(configProvider.shouldTrackHttpBody("notinallowlist.com", contentType))
    }

    @Test
    fun `shouldTrackHttpBody returns false for a disallowed content type`() {
        val url = "https://example.com/"
        val contentType = "text/plain"
        Assert.assertFalse(configProvider.shouldTrackHttpBody(url, contentType))
    }

    @Test
    fun `shouldTrackHttpBody returns false for a disallowed URL and content type`() {
        val url = "example.com/sessions"
        val contentType = "text/plain"
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(httpUrlBlocklist = listOf("example.com")),
        )
        Assert.assertFalse(configProvider.shouldTrackHttpBody(url, contentType))
    }

    @Test
    fun `shouldTrackHttpBody returns false for configured measure URL`() {
        val url = "https://measure.com/"
        val contentType = "application/json"
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(),
        )
        configProvider.setMeasureUrl("measure.com")
        Assert.assertFalse(configProvider.shouldTrackHttpBody(url, contentType))
    }

    @Test
    fun `shouldTrackHttpHeader returns true for a allowed header`() {
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(trackHttpHeaders = true, httpHeadersBlocklist = listOf("key1")),
        )
        Assert.assertTrue(configProvider.shouldTrackHttpHeader("key2"))
    }

    @Test
    fun `shouldTrackHttpHeader returns false for a blocked header`() {
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(httpHeadersBlocklist = listOf("key1")),
        )
        Assert.assertFalse(configProvider.shouldTrackHttpHeader("key1"))
    }

    @Test
    fun `shouldTrackHttpUrl given urlAllowlist and urlBlocklist are empty, returns true for any url`() {
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(httpUrlAllowlist = emptyList(), httpUrlBlocklist = emptyList()),
        )
        Assert.assertTrue(configProvider.shouldTrackHttpUrl("https://allowed.com/"))
    }

    @Test
    fun `shouldTrackHttpUrl given urlAllowlist is not empty, returns true if url is part of allowlist`() {
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(httpUrlAllowlist = listOf("allowed.com")),
        )
        Assert.assertTrue(configProvider.shouldTrackHttpUrl("https://allowed.com/"))
        Assert.assertFalse(configProvider.shouldTrackHttpUrl("https://blocked.com/"))
    }

    @Test
    fun `shouldTrackHttpUrl given urlAllowlist is empty, urlBlocklist is not empty, returns true if url is not part of blocklist`() {
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(
                httpUrlBlocklist = listOf("blocked.com"),
                httpUrlAllowlist = emptyList(),
            ),
        )
        Assert.assertTrue(configProvider.shouldTrackHttpUrl("https://allowed.com/"))
        Assert.assertFalse(configProvider.shouldTrackHttpUrl("https://blocked.com/"))
    }

    @Test
    fun `shouldTrackHttpUrl given both urlAllowlist and urlBlocklist are not empty, considers only the allowlist`() {
        val configProvider = ConfigProviderImpl(
            defaultConfig = Config(
                httpUrlAllowlist = listOf("allowed.com", "unblocked.com"),
                httpUrlBlocklist = listOf("unblocked.com"),
            ),
        )
        Assert.assertTrue(configProvider.shouldTrackHttpUrl("https://allowed.com/"))
        Assert.assertTrue(configProvider.shouldTrackHttpUrl("https://unblocked.com/"))
    }
}
