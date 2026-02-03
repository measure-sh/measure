package sh.measure.android

import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import sh.measure.android.config.ClientInfo
import sh.measure.android.config.DynamicConfig
import sh.measure.android.utils.ManifestMetadata

class MeasureInternalTest {
    private fun mockMeasureInitializer(): MeasureInitializer {
        val initializer = mock(MeasureInitializer::class.java)

        // Stubbing all fields with mocks
        `when`(initializer.logger).thenReturn(mock())
        `when`(initializer.signalProcessor).thenReturn(mock())
        `when`(initializer.httpEventCollector).thenReturn(mock())
        `when`(initializer.processInfoProvider).thenReturn(mock())
        `when`(initializer.timeProvider).thenReturn(mock())
        `when`(initializer.bugReportCollector).thenReturn(mock())
        `when`(initializer.spanCollector).thenReturn(mock())
        `when`(initializer.customEventCollector).thenReturn(mock())
        `when`(initializer.sessionManager).thenReturn(mock())
        `when`(initializer.userTriggeredEventCollector).thenReturn(mock())
        `when`(initializer.resumedActivityProvider).thenReturn(mock())
        `when`(initializer.networkClient).thenReturn(mock())
        `when`(initializer.manifestReader).thenReturn(mock())
        `when`(initializer.unhandledExceptionCollector).thenReturn(mock())
        `when`(initializer.anrCollector).thenReturn(mock())
        `when`(initializer.cpuUsageCollector).thenReturn(mock())
        `when`(initializer.memoryUsageCollector).thenReturn(mock())
        `when`(initializer.componentCallbacksCollector).thenReturn(mock())
        `when`(initializer.appLifecycleManager).thenReturn(mock())
        `when`(initializer.activityLifecycleCollector).thenReturn(mock())
        `when`(initializer.appLifecycleCollector).thenReturn(mock())
        `when`(initializer.gestureCollector).thenReturn(mock())
        `when`(initializer.appLaunchCollector).thenReturn(mock())
        `when`(initializer.networkChangesCollector).thenReturn(mock())
        `when`(initializer.appExitCollector).thenReturn(mock())
        `when`(initializer.userAttributeProcessor).thenReturn(mock())
        `when`(initializer.configProvider).thenReturn(mock())
        `when`(initializer.dataCleanupService).thenReturn(mock())
        `when`(initializer.powerStateProvider).thenReturn(mock())
        `when`(initializer.periodicSignalStoreScheduler).thenReturn(mock())
        `when`(initializer.executorServiceRegistry).thenReturn(mock())
        `when`(initializer.shakeBugReportCollector).thenReturn(mock())
        `when`(initializer.internalSignalCollector).thenReturn(mock())
        `when`(initializer.configLoader).thenReturn(mock())
        `when`(initializer.spanProcessor).thenReturn(mock())
        `when`(initializer.exporter).thenReturn(mock())

        return initializer
    }

    @Test
    fun `init with valid clientInfo initializes network client`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(
            apiKey = "msrsh_123",
            apiUrl = "https://api.measure.sh",
        )
        val measureInternal = MeasureInternal(initializer)

        measureInternal.init(clientInfo)

        verify(initializer.networkClient).init("https://api.measure.sh", "msrsh_123")
        verify(initializer.appLifecycleManager).register()
        verify(initializer.resumedActivityProvider).register()
        verify(initializer.appLaunchCollector).register()
    }

    @Test
    fun `init with valid manifest initializes network client`() {
        val initializer = mockMeasureInitializer()
        val manifest = ManifestMetadata("https://api.measure.sh", "msrsh_456")
        whenever(initializer.manifestReader.load()).thenReturn(manifest)
        val measureInternal = MeasureInternal(initializer)

        measureInternal.init(null)

        verify(initializer.networkClient).init("https://api.measure.sh", "msrsh_456")
    }

    @Test
    fun `init sets up lifecycle listeners`() {
        val initializer = initWithValidCredentials()

        verify(initializer.appLifecycleManager).register()
        verify(initializer.resumedActivityProvider).register()
        verify(initializer.appLaunchCollector).register()
    }

    @Test
    fun `init loads config and updates config provider`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(
            apiKey = "msrsh_123",
            apiUrl = "https://api.measure.sh",
        )
        val measureInternal = MeasureInternal(initializer)
        val dynamicConfig = DynamicConfig.default()
        val callbackCaptor = argumentCaptor<(DynamicConfig?) -> Unit>()
        measureInternal.init(clientInfo)

        verify(initializer.configLoader).loadDynamicConfig(callbackCaptor.capture())
        callbackCaptor.firstValue.invoke(dynamicConfig)

        verify(initializer.configProvider).setDynamicConfig(dynamicConfig)
    }

    @Test
    fun `init loads config updates various components`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(
            apiKey = "msrsh_123",
            apiUrl = "https://api.measure.sh",
        )
        val callbackCaptor = argumentCaptor<(DynamicConfig?) -> Unit>()
        val measureInternal = MeasureInternal(initializer)

        measureInternal.init(clientInfo)

        verify(initializer.configLoader).loadDynamicConfig(callbackCaptor.capture())
        callbackCaptor.firstValue.invoke(DynamicConfig.default())

        verify(initializer.sessionManager).onConfigLoaded()
        verify(initializer.spanProcessor).onConfigLoaded()
        verify(initializer.appLaunchCollector).onConfigLoaded()
        verify(initializer.exporter).export()

        // TODO: the following assertions require robolectric
        // verify(initializer.cpuUsageCollector).onConfigLoaded()
        // verify(initializer.memoryUsageCollector).onConfigLoaded()
        // verify(initializer.appExitCollector).collect()
    }

    @Test
    fun `onAppBackground unregisters CPU and Memory usage collectors`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(
            apiKey = "msrsh_123",
            apiUrl = "https://api.measure.sh",
        )
        val measureInternal = MeasureInternal(initializer)
        measureInternal.init(clientInfo)
        measureInternal.start()

        measureInternal.onAppBackground()

        verify(initializer.cpuUsageCollector).unregister()
        verify(initializer.memoryUsageCollector).unregister()
    }

    @Test
    fun `onAppBackground triggers signal store scheduler`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(
            apiKey = "msrsh_123",
            apiUrl = "https://api.measure.sh",
        )
        val measureInternal = MeasureInternal(initializer)
        measureInternal.init(clientInfo)
        measureInternal.start()

        measureInternal.onAppBackground()

        verify(initializer.periodicSignalStoreScheduler).onAppBackground()
    }

    @Test
    fun `onAppBackground triggers data cleanup`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(
            apiKey = "msrsh_123",
            apiUrl = "https://api.measure.sh",
        )
        val measureInternal = MeasureInternal(initializer)
        measureInternal.init(clientInfo)
        measureInternal.start()

        measureInternal.onAppBackground()

        verify(initializer.dataCleanupService).cleanup()
    }

    @Test
    fun `onAppBackground triggers export`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(
            apiKey = "msrsh_123",
            apiUrl = "https://api.measure.sh",
        )
        val measureInternal = MeasureInternal(initializer)
        measureInternal.init(clientInfo)
        measureInternal.start()

        measureInternal.onAppBackground()

        verify(initializer.exporter).export()
    }

    @Test
    fun `init with empty apiUrl does not initialize`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(apiKey = "msrsh_123", apiUrl = "")
        val measureInternal = MeasureInternal(initializer)

        measureInternal.init(clientInfo)

        verify(initializer.networkClient, never()).init(any(), any())
        verify(initializer.sessionManager, never()).init()
    }

    @Test
    fun `init with empty apiKey does not initialize`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(apiKey = "", apiUrl = "https://api.measure.sh")
        val measureInternal = MeasureInternal(initializer)

        measureInternal.init(clientInfo)

        verify(initializer.networkClient, never()).init(any(), any())
        verify(initializer.sessionManager, never()).init()
    }

    @Test
    fun `init with invalid apiKey prefix does not initialize`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(apiKey = "invalid_key", apiUrl = "https://api.measure.sh")
        val measureInternal = MeasureInternal(initializer)

        measureInternal.init(clientInfo)

        verify(initializer.networkClient, never()).init(any(), any())
        verify(initializer.sessionManager, never()).init()
    }

    @Test
    fun `init with null manifest and null clientInfo does not initialize`() {
        val initializer = mockMeasureInitializer()
        whenever(initializer.manifestReader.load()).thenReturn(null)
        val measureInternal = MeasureInternal(initializer)

        measureInternal.init(null)

        verify(initializer.networkClient, never()).init(any(), any())
        verify(initializer.sessionManager, never()).init()
    }

    @Test
    fun `init with auto-start disabled does not register collectors`() {
        val initializer = mockMeasureInitializer()
        `when`(initializer.configProvider.autoStart).thenReturn(false)

        val measureInternal = MeasureInternal(initializer)
        measureInternal.init()

        verify(initializer.userTriggeredEventCollector, never()).register()
        verify(initializer.activityLifecycleCollector, never()).register()
        verify(initializer.appLifecycleCollector, never()).register()
        verify(initializer.cpuUsageCollector, never()).register()
        verify(initializer.memoryUsageCollector, never()).register()
        verify(initializer.componentCallbacksCollector, never()).register()
        verify(initializer.gestureCollector, never()).register()
        verify(initializer.networkChangesCollector, never()).register()
        verify(initializer.httpEventCollector, never()).register()
        verify(initializer.powerStateProvider, never()).register()
        verify(initializer.spanCollector, never()).register()
        verify(initializer.customEventCollector, never()).register()
        verify(initializer.periodicSignalStoreScheduler, never()).register()
        verify(initializer.appLaunchCollector, never()).register()
    }

    @Test
    fun `start registers all collectors`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)

        measureInternal.start()

        verify(initializer.userTriggeredEventCollector).register()
        verify(initializer.activityLifecycleCollector).register()
        verify(initializer.appLifecycleCollector).register()
        verify(initializer.cpuUsageCollector).register()
        verify(initializer.memoryUsageCollector).register()
        verify(initializer.componentCallbacksCollector).register()
        verify(initializer.gestureCollector).register()
        verify(initializer.networkChangesCollector).register()
        verify(initializer.httpEventCollector).register()
        verify(initializer.powerStateProvider).register()
        verify(initializer.spanCollector).register()
        verify(initializer.customEventCollector).register()
        verify(initializer.periodicSignalStoreScheduler).register()
    }

    @Test
    fun `start enables crash tracking`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)

        measureInternal.start()

        verify(initializer.unhandledExceptionCollector).register()
        verify(initializer.anrCollector).register()
    }

    @Test
    fun `start is idempotent`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)

        measureInternal.start()
        measureInternal.start()

        verify(initializer.gestureCollector, times(1)).register()
        verify(initializer.unhandledExceptionCollector, times(1)).register()
    }

    @Test
    fun `stop unregisters all collectors`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)
        measureInternal.start()

        measureInternal.stop()

        verify(initializer.userTriggeredEventCollector).unregister()
        verify(initializer.activityLifecycleCollector).unregister()
        verify(initializer.appLifecycleCollector).unregister()
        verify(initializer.cpuUsageCollector).unregister()
        verify(initializer.memoryUsageCollector).unregister()
        verify(initializer.componentCallbacksCollector).unregister()
        verify(initializer.gestureCollector).unregister()
        verify(initializer.networkChangesCollector).unregister()
        verify(initializer.httpEventCollector).unregister()
        verify(initializer.powerStateProvider).unregister()
        verify(initializer.spanCollector).unregister()
        verify(initializer.customEventCollector).unregister()
        verify(initializer.periodicSignalStoreScheduler).unregister()
    }

    @Test
    fun `stop disables crash tracking`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)
        measureInternal.start()

        measureInternal.stop()

        verify(initializer.unhandledExceptionCollector).unregister()
        verify(initializer.anrCollector).unregister()
    }

    @Test
    fun `stop is idempotent`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)
        measureInternal.start()

        measureInternal.stop()
        measureInternal.stop()

        verify(initializer.gestureCollector, times(1)).unregister()
        verify(initializer.unhandledExceptionCollector, times(1)).unregister()
    }

    @Test
    fun `stop before start does nothing`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)

        measureInternal.stop()

        verify(initializer.gestureCollector, never()).unregister()
        verify(initializer.unhandledExceptionCollector, never()).unregister()
    }

    private fun initWithValidCredentials(): MeasureInitializer {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(
            apiKey = "msrsh_123",
            apiUrl = "https://api.measure.sh",
        )
        val measureInternal = MeasureInternal(initializer)
        measureInternal.init(clientInfo)
        return initializer
    }
}
