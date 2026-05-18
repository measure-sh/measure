package sh.measure.android.config

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import sh.measure.android.exporter.NetworkClient
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.storage.FileStorage
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import java.io.File
import java.time.Duration

internal class ConfigLoaderImplTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val networkClient = mock<NetworkClient>()
    private val fileStorage = mock<FileStorage>()
    private val prefsStorage = mock<PrefsStorage>()
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val logger = NoopLogger()

    private lateinit var configLoader: ConfigLoaderImpl

    @Before
    fun setUp() {
        configLoader = ConfigLoaderImpl(
            ioExecutor = executorService,
            networkClient = networkClient,
            fileStorage = fileStorage,
            prefsStorage = prefsStorage,
            timeProvider = timeProvider,
            logger = logger,
            exportExecutor = executorService,
        )
    }

    @Test
    fun `loadDynamicConfig returns null when config file does not exist`() {
        // Given
        `when`(fileStorage.getConfigFile()).thenReturn(null)

        // When
        var result: DynamicConfig? = TestData.getDynamicConfig()
        var callbackInvoked = false
        configLoader.loadDynamicConfig { config ->
            result = config
            callbackInvoked = true
        }

        // Then
        assertTrue(callbackInvoked)
        assertNull(result)
    }

    @Test
    fun `loadDynamicConfig returns null when config file is empty`() {
        // Given
        val emptyFile = createTempConfigFile("")
        `when`(fileStorage.getConfigFile()).thenReturn(emptyFile)

        // When
        var result: DynamicConfig? = TestData.getDynamicConfig()
        configLoader.loadDynamicConfig { config ->
            result = config
        }

        // Then
        assertNull(result)
        emptyFile.delete()
    }

    @Test
    fun `loadDynamicConfig returns null when config file contains invalid JSON`() {
        // Given
        val invalidJsonFile = createTempConfigFile("{ invalid json }")
        `when`(fileStorage.getConfigFile()).thenReturn(invalidJsonFile)

        // When
        var result: DynamicConfig? = TestData.getDynamicConfig()
        configLoader.loadDynamicConfig { config ->
            result = config
        }

        // Then
        assertNull(result)
        invalidJsonFile.delete()
    }

    @Test
    fun `loadDynamicConfig returns config when valid config file exists`() {
        // Given
        val validConfig = """
            {
                "max_events_in_batch": 100,
                "crash_timeline_duration": 30000,
                "anr_timeline_duration": 30000,
                "bug_report_timeline_duration": 30000,
                "trace_sampling_rate": 0.5,
                "journey_sampling_rate": 1.0,
                "screenshot_mask_level": "all_text_and_media",
                "cpu_usage_interval": 3000,
                "memory_usage_interval": 3000,
                "crash_take_screenshot": true,
                "crash_timeline_sampling_rate": 1.0,
                "anr_take_screenshot": false,
                "anr_timeline_sampling_rate": 1.0,
                "launch_sampling_rate": 1.0,
                "gesture_click_take_snapshot": false,
                "http_disable_event_for_urls": [],
                "http_track_request_for_urls": [],
                "http_track_response_for_urls": [],
                "http_blocked_headers": []
            }
        """.trimIndent()
        val configFile = createTempConfigFile(validConfig)
        `when`(fileStorage.getConfigFile()).thenReturn(configFile)
        `when`(prefsStorage.getConfigFetchTimestamp()).thenReturn(timeProvider.now())
        `when`(prefsStorage.getConfigCacheControl()).thenReturn(3600L)
        // Advance by less than cache duration so cache is NOT expired
        testClock.advance(Duration.ofMillis(2000))

        // When
        var result: DynamicConfig? = null
        configLoader.loadDynamicConfig { config ->
            result = config
        }

        // Then
        assertEquals(100, result?.maxEventsInBatch)
        assertEquals(0.5f, result?.traceSamplingRate)
        assertEquals(true, result?.crashTakeScreenshot)
        configFile.delete()
    }

    @Test
    fun `loadDynamicConfig fetches config when cache control expired`() {
        // Given
        val configFile = createTempConfigFile("{}")
        `when`(fileStorage.getConfigFile()).thenReturn(configFile)
        setupCacheExpired()
        val etag = "etag-123"
        `when`(prefsStorage.getConfigEtag()).thenReturn(etag)
        `when`(networkClient.getConfig(etag)).thenReturn(ConfigResponse.NotModified)

        // When
        configLoader.loadDynamicConfig { }

        // Then
        verify(networkClient).getConfig(etag)
        configFile.delete()
    }

    @Test
    fun `loadDynamicConfig updates file and prefs on successful response`() {
        // Given
        val configFile = createTempConfigFile("{}")
        `when`(fileStorage.getConfigFile()).thenReturn(configFile)
        setupCacheExpired()
        val expectedTimestamp = timeProvider.now()
        val newConfig = """{"http_body_capture_enabled": true}"""
        val newEtag = "new-etag"
        val newCacheControl = 3600L
        `when`(networkClient.getConfig(any())).thenReturn(
            ConfigResponse.Success(
                body = newConfig,
                eTag = newEtag,
                cacheControl = newCacheControl,
            ),
        )

        // When
        configLoader.loadDynamicConfig { }

        // Then
        assertEquals(newConfig, configFile.readText())
        verify(prefsStorage).setConfigFetchTimestamp(expectedTimestamp)
        verify(prefsStorage).setConfigEtag(newEtag)
        verify(prefsStorage).setConfigCacheControl(newCacheControl)
        configFile.delete()
    }

    @Test
    fun `loadDynamicConfig does not update etag when response etag is null`() {
        // Given
        val configFile = createTempConfigFile("{}")
        `when`(fileStorage.getConfigFile()).thenReturn(configFile)
        setupCacheExpired()
        `when`(networkClient.getConfig(any())).thenReturn(
            ConfigResponse.Success(
                body = "{}",
                eTag = null,
                cacheControl = 3600L,
            ),
        )

        // When
        configLoader.loadDynamicConfig { }

        // Then
        verify(prefsStorage, never()).setConfigEtag(any())
        configFile.delete()
    }

    @Test
    fun `loadDynamicConfig does not update file on NotModified response`() {
        // Given
        val originalContent = """{"original": true}"""
        val configFile = createTempConfigFile(originalContent)
        `when`(fileStorage.getConfigFile()).thenReturn(configFile)
        setupCacheExpired()
        `when`(networkClient.getConfig(any())).thenReturn(ConfigResponse.NotModified)

        // When
        configLoader.loadDynamicConfig { }

        // Then
        assertEquals(originalContent, configFile.readText())
        verify(prefsStorage, never()).setConfigFetchTimestamp(any())
        configFile.delete()
    }

    @Test
    fun `loadDynamicConfig does not update file on Error response`() {
        // Given
        val originalContent = """{"original": true}"""
        val configFile = createTempConfigFile(originalContent)
        `when`(fileStorage.getConfigFile()).thenReturn(configFile)
        setupCacheExpired()
        `when`(networkClient.getConfig(any())).thenReturn(
            ConfigResponse.Error(RuntimeException("Network error")),
        )

        // When
        configLoader.loadDynamicConfig { }

        // Then
        assertEquals(originalContent, configFile.readText())
        verify(prefsStorage, never()).setConfigFetchTimestamp(any())
        configFile.delete()
    }

    private fun setupCacheExpired() {
        val cacheControlDuration = 3600L
        // Set last fetch time to current time
        `when`(prefsStorage.getConfigFetchTimestamp()).thenReturn(timeProvider.now())
        `when`(prefsStorage.getConfigCacheControl()).thenReturn(cacheControlDuration)
        // Advance clock beyond cache duration to make it expired
        testClock.advance(Duration.ofMillis(cacheControlDuration + 1000))
        `when`(prefsStorage.getConfigEtag()).thenReturn("")
    }

    private fun createTempConfigFile(content: String): File = File.createTempFile("config", ".json").apply {
        writeText(content)
        deleteOnExit()
    }
}
