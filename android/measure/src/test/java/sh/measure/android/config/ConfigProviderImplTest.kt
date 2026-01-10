package sh.measure.android.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ConfigProviderImplTest {

    private lateinit var configProvider: ConfigProviderImpl
    private lateinit var defaultConfig: Config

    @Before
    fun setUp() {
        defaultConfig = Config()
        configProvider = ConfigProviderImpl(defaultConfig)
    }

    @Test
    fun `shouldTrackHttpEvent returns true when no URLs are blocked`() {
        assertTrue(configProvider.shouldTrackHttpEvent("https://api.example.com/data"))
    }

    @Test
    fun `shouldTrackHttpEvent returns false for exact match in block list`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpDisableEventForUrls = mutableListOf("https://api.example.com/data"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpEvent("https://api.example.com/data"))
    }

    @Test
    fun `shouldTrackHttpEvent returns false for wildcard match`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpDisableEventForUrls = mutableListOf("https://api.example.com/*"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpEvent("https://api.example.com/users"))
        assertFalse(configProvider.shouldTrackHttpEvent("https://api.example.com/data/123"))
    }

    @Test
    fun `shouldTrackHttpEvent returns true when URL does not match wildcard pattern`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpDisableEventForUrls = mutableListOf("https://api.example.com/*"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertTrue(configProvider.shouldTrackHttpEvent("https://other.example.com/data"))
    }

    @Test
    fun `shouldTrackHttpEvent handles wildcard in between path`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpDisableEventForUrls = mutableListOf("https://api.example.com/*/users"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpEvent("https://api.example.com/data/users"))
        assertTrue(configProvider.shouldTrackHttpEvent("https://api.example.com/data/nomatch"))
    }

    @Test
    fun `shouldTrackHttpEvent handles multiple wildcard patterns`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpDisableEventForUrls = mutableListOf(
                "https://analytics.example.com/*",
                "https://tracking.example.com/*",
            ),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpEvent("https://analytics.example.com/event"))
        assertFalse(configProvider.shouldTrackHttpEvent("https://tracking.example.com/ping"))
        assertTrue(configProvider.shouldTrackHttpEvent("https://api.example.com/data"))
    }

    @Test
    fun `shouldTrackHttpRequestBody returns false when no URLs are configured`() {
        assertFalse(configProvider.shouldTrackHttpRequestBody("https://api.example.com/data"))
    }

    @Test
    fun `shouldTrackHttpRequestBody returns true for request URL match`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpTrackRequestForUrls = listOf("https://api.example.com/*"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertTrue(configProvider.shouldTrackHttpRequestBody("https://api.example.com/users"))
    }

    @Test
    fun `shouldTrackHttpRequestBody returns false when URL not in request list`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpTrackRequestForUrls = listOf("https://api.example.com/*"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpRequestBody("https://other.example.com/data"))
    }

    @Test
    fun `shouldTrackHttpResponseBody returns false when no URLs are configured`() {
        assertFalse(configProvider.shouldTrackHttpResponseBody("https://api.example.com/data"))
    }

    @Test
    fun `shouldTrackHttpResponseBody returns true for response URL match`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpTrackResponseForUrls = listOf("https://api.example.com/*"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertTrue(configProvider.shouldTrackHttpResponseBody("https://api.example.com/users"))
    }

    @Test
    fun `shouldTrackHttpResponseBody returns false when URL not in response list`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpTrackResponseForUrls = listOf("https://api.example.com/*"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpResponseBody("https://other.example.com/data"))
    }

    @Test
    fun `request and response body tracking are independent`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpTrackRequestForUrls = listOf("https://request.example.com/*"),
            httpTrackResponseForUrls = listOf("https://response.example.com/*"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        // Request URL only matches request tracking
        assertTrue(configProvider.shouldTrackHttpRequestBody("https://request.example.com/data"))
        assertFalse(configProvider.shouldTrackHttpResponseBody("https://request.example.com/data"))

        // Response URL only matches response tracking
        assertFalse(configProvider.shouldTrackHttpRequestBody("https://response.example.com/data"))
        assertTrue(configProvider.shouldTrackHttpResponseBody("https://response.example.com/data"))

        // Unrelated URL matches neither
        assertFalse(configProvider.shouldTrackHttpRequestBody("https://other.example.com/data"))
        assertFalse(configProvider.shouldTrackHttpResponseBody("https://other.example.com/data"))
    }

    @Test
    fun `shouldTrackHttpHeader returns false for default blocked header`() {
        assertFalse(configProvider.shouldTrackHttpHeader("Authorization"))
        assertFalse(configProvider.shouldTrackHttpHeader("Cookie"))
        assertFalse(configProvider.shouldTrackHttpHeader("Set-Cookie"))
        assertFalse(configProvider.shouldTrackHttpHeader("Proxy-Authorization"))
        assertFalse(configProvider.shouldTrackHttpHeader("WWW-Authenticate"))
        assertFalse(configProvider.shouldTrackHttpHeader("X-Api-Key"))
    }

    @Test
    fun `shouldTrackHttpHeader returns comparison is case insensitive`() {
        assertFalse(configProvider.shouldTrackHttpHeader("Authorization"))
        assertFalse(configProvider.shouldTrackHttpHeader("authorization"))
    }

    @Test
    fun `shouldTrackHttpHeader returns false for dynamically loaded blocked header`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpBlockedHeaders = mutableListOf("X-Custom-Header"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpHeader("X-Custom-Header"))
    }

    @Test
    fun `setMeasureUrl adds URL to httpDisableEventForUrls`() {
        val measureUrl = "https://measure.sh/api/v1"
        configProvider.setMeasureUrl(measureUrl)

        assertFalse(configProvider.shouldTrackHttpEvent(measureUrl))
    }

    @Test
    fun `setMeasureUrl is preserved after setDynamicConfig is called`() {
        val measureUrl = "https://measure.sh/api/v1"
        configProvider.setMeasureUrl(measureUrl)

        // Simulate loading dynamic config from server
        val dynamicConfig = DynamicConfig.default().copy(
            httpDisableEventForUrls = mutableListOf("https://analytics.example.com/*"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        // Both should be blocked
        assertFalse(configProvider.shouldTrackHttpEvent(measureUrl))
        assertFalse(configProvider.shouldTrackHttpEvent("https://analytics.example.com/event"))
    }

    @Test
    fun `setDynamicConfig updates config values`() {
        val newConfig = DynamicConfig.default().copy(
            traceSamplingRate = 0.5f,
            crashTakeScreenshot = false,
            cpuUsageInterval = 5000L,
        )
        configProvider.setDynamicConfig(newConfig)

        assertEquals(0.5f, configProvider.traceSamplingRate)
        assertFalse(configProvider.crashTakeScreenshot)
        assertEquals(5000L, configProvider.cpuUsageInterval)
    }

    @Test
    fun `wildcard at beginning of pattern matches`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpDisableEventForUrls = mutableListOf("*/api/v1/health"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpEvent("https://example.com/api/v1/health"))
        assertFalse(configProvider.shouldTrackHttpEvent("https://other.com/api/v1/health"))
    }

    @Test
    fun `wildcard in middle of pattern matches`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpDisableEventForUrls = mutableListOf("https://*/api/health"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpEvent("https://example.com/api/health"))
    }

    @Test
    fun `pattern with special regex characters is escaped properly`() {
        val dynamicConfig = DynamicConfig.default().copy(
            httpDisableEventForUrls = mutableListOf("https://api.example.com/path?query=value"),
        )
        configProvider.setDynamicConfig(dynamicConfig)

        assertFalse(configProvider.shouldTrackHttpEvent("https://api.example.com/path?query=value"))
        // The ? should be literal, not regex "match 0 or 1"
        assertTrue(configProvider.shouldTrackHttpEvent("https://api.example.com/pathquery=value"))
    }
}
