package sh.measure.android.config

import org.junit.Assert
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.kotlin.argumentCaptor

class ConfigProviderTest {
    private val configLoader = mock<ConfigLoader>()
    private val defaultConfig = MeasureConfig()
    private val configProvider = ConfigProviderImpl(
        defaultConfig = defaultConfig,
        configLoader = configLoader,
    )

    @Test
    fun `loads cached config on initialization`() {
        verify(configLoader).getCachedConfig()
    }

    @Test
    fun `loads network config and keeps a copy of the loaded config`() {
        val networkConfig = MeasureConfig()
        val onSuccess = argumentCaptor<(MeasureConfig) -> Unit>()
        `when`(configLoader.getNetworkConfig(onSuccess.capture())).thenAnswer { }

        configProvider.loadNetworkConfig()
        onSuccess.firstValue.invoke(networkConfig)

        assertEquals(networkConfig, configProvider.networkConfig)
    }

    @Test
    fun `gives precedence to network config when a config is fetched`() {
        `when`(configLoader.getCachedConfig()).thenReturn(MeasureConfig(trackScreenshotOnCrash = false))
        val configProvider = ConfigProviderImpl(
            defaultConfig = MeasureConfig(trackScreenshotOnCrash = false),
            configLoader = configLoader,
        )

        val networkConfig = MeasureConfig(trackScreenshotOnCrash = true)
        configProvider.networkConfig = networkConfig

        assertEquals(true, configProvider.trackScreenshotOnCrash)
    }

    @Test
    fun `given network config is not available gives precedence to cached config`() {
        `when`(configLoader.getCachedConfig()).thenReturn(MeasureConfig(trackScreenshotOnCrash = true))
        val configProvider = ConfigProviderImpl(
            defaultConfig = MeasureConfig(trackScreenshotOnCrash = false),
            configLoader = configLoader,
        )
        configProvider.networkConfig = null

        assertEquals(true, configProvider.trackScreenshotOnCrash)
    }

    @Test
    fun `given network config and cached config are unavailable, returns default config value`() {
        `when`(configLoader.getCachedConfig()).thenReturn(null)
        val configProvider = ConfigProviderImpl(
            defaultConfig = MeasureConfig(trackScreenshotOnCrash = true),
            configLoader = configLoader,
        )
        configProvider.networkConfig = null

        assertEquals(true, configProvider.trackScreenshotOnCrash)
    }

    @Test
    fun `shouldTrackHttpBody returns true for a allowed URL and content type`() {
        val url = "example.com"
        val contentType = "application/json"
        val configProvider = ConfigProviderImpl(
            defaultConfig = MeasureConfig(httpUrlBlocklist = listOf("allowed.com")),
            configLoader = configLoader,
        )
        Assert.assertTrue(configProvider.shouldTrackHttpBody(url, contentType))
    }

    @Test
    fun `shouldTrackHttpBody returns false for a disallowed URL`() {
        val url = "example.com"
        val contentType = "application/json"
        val configProvider = ConfigProviderImpl(
            defaultConfig = MeasureConfig(httpUrlBlocklist = listOf("example.com")),
            configLoader = configLoader,
        )
        Assert.assertFalse(configProvider.shouldTrackHttpBody(url, contentType))
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
            defaultConfig = MeasureConfig(httpUrlBlocklist = listOf("example.com")),
            configLoader = configLoader,
        )
        Assert.assertFalse(configProvider.shouldTrackHttpBody(url, contentType))
    }

    @Test
    fun `shouldTrackHttpHeader returns true for a allowed header`() {
        val configProvider = ConfigProviderImpl(
            defaultConfig = MeasureConfig(httpHeadersBlocklist = listOf("key1")),
            configLoader = configLoader,
        )
        Assert.assertTrue(configProvider.shouldTrackHttpHeader("key2"))
    }

    @Test
    fun `shouldTrackHttpHeader returns false for a blocked header`() {
        val configProvider = ConfigProviderImpl(
            defaultConfig = MeasureConfig(httpHeadersBlocklist = listOf("key1")),
            configLoader = configLoader,
        )
        Assert.assertFalse(configProvider.shouldTrackHttpHeader("key1"))
    }
}
