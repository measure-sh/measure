package sh.measure.android

import junit.framework.TestCase.assertNull
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import sh.measure.android.config.ClientInfo
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.ManifestMetadata
import sh.measure.android.utils.NoopActivityLifecycleController
import sh.measure.android.utils.TestClock

class MeasureInternalTest {
    private val logger = NoopLogger()
    private val sessionManager = FakeSessionManager()
    private val configProvider = FakeConfigProvider()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val processInfoProvider = FakeProcessInfoProvider()

    private fun mockMeasureInitializer(): MeasureInitializer {
        val initializer = mock(MeasureInitializer::class.java)

        // Stubbing all fields with mocks
        `when`(initializer.logger).thenReturn(logger)
        `when`(initializer.signalProcessor).thenReturn(mock())
        `when`(initializer.httpEventCollector).thenReturn(mock())
        `when`(initializer.processInfoProvider).thenReturn(processInfoProvider)
        `when`(initializer.timeProvider).thenReturn(timeProvider)
        `when`(initializer.bugReportCollector).thenReturn(mock())
        `when`(initializer.spanCollector).thenReturn(mock())
        `when`(initializer.customEventCollector).thenReturn(mock())
        `when`(initializer.sessionManager).thenReturn(sessionManager)
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
        `when`(initializer.activityLifecycleCollector).thenReturn(NoopActivityLifecycleController())
        `when`(initializer.appLifecycleCollector).thenReturn(mock())
        `when`(initializer.gestureCollector).thenReturn(mock())
        `when`(initializer.appLaunchCollector).thenReturn(mock())
        `when`(initializer.networkChangesCollector).thenReturn(mock())
        `when`(initializer.appExitCollector).thenReturn(mock())
        `when`(initializer.periodicExporter).thenReturn(mock())
        `when`(initializer.userAttributeProcessor).thenReturn(mock())
        `when`(initializer.configProvider).thenReturn(configProvider)
        `when`(initializer.dataCleanupService).thenReturn(mock())
        `when`(initializer.powerStateProvider).thenReturn(mock())
        `when`(initializer.periodicSignalStoreScheduler).thenReturn(mock())
        `when`(initializer.executorServiceRegistry).thenReturn(mock())
        `when`(initializer.shakeBugReportCollector).thenReturn(mock())
        `when`(initializer.internalSignalCollector).thenReturn(mock())
        `when`(initializer.attachmentExporter).thenReturn(mock())
        `when`(initializer.configLoader).thenReturn(mock())

        return initializer
    }

    @Test
    fun `init uses manifest when clientInfo is null`() {
        val initializer = mockMeasureInitializer()
        val manifest = ManifestMetadata("https://api.measure.sh", "msrsh_123")
        whenever(initializer.manifestReader.load()).thenReturn(manifest)

        val measureInternal = MeasureInternal(initializer)
        measureInternal.init()

        verify(initializer.networkClient).init("https://api.measure.sh", "msrsh_123")
    }

    @Test
    fun `init logs error when api key is invalid`() {
        val initializer = mockMeasureInitializer()
        val clientInfo = ClientInfo(apiKey = "invalid_key", apiUrl = "https://api.measure.sh")
        val measureInternal = MeasureInternal(initializer)

        measureInternal.init(clientInfo)

        verify(initializer.networkClient, never()).init(any(), any())
    }

    @Test
    fun `start is idempotent`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)

        measureInternal.start()
        measureInternal.start()

        verify(initializer.unhandledExceptionCollector, times(1)).register()
    }

    @Test
    fun `stop unregisters collectors`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)
        measureInternal.start()
        measureInternal.stop()

        verify(initializer.unhandledExceptionCollector).unregister()
        verify(initializer.anrCollector).unregister()
        verify(initializer.userTriggeredEventCollector).unregister()
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
    fun `getSessionId returns null if exception`() {
        val initializer = mockMeasureInitializer()
        whenever(initializer.sessionManager.getSessionId()).thenThrow(IllegalArgumentException())
        val measureInternal = MeasureInternal(initializer)

        val sessionId = measureInternal.getSessionId()

        assertNull(sessionId)
    }

    @Test
    fun `trackEvent calls customEventCollector`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)

        measureInternal.trackEvent("click", emptyMap(), 12345L)

        verify(initializer.customEventCollector).trackEvent("click", emptyMap(), 12345L)
    }

    @Test
    fun `onAppForeground resumes collectors when started`() {
        val initializer = mockMeasureInitializer()
        val measureInternal = MeasureInternal(initializer)

        measureInternal.start()
        measureInternal.onAppForeground()

        // Twice as it's called once on start and
        // then on app foreground
        verify(initializer.unhandledExceptionCollector).register()
        verify(initializer.anrCollector).register()
        verify(initializer.userTriggeredEventCollector, times(2)).register()
        verify(initializer.appLifecycleCollector, times(2)).register()
        verify(initializer.cpuUsageCollector, times(2)).register()
        verify(initializer.memoryUsageCollector, times(2)).register()
        verify(initializer.componentCallbacksCollector, times(2)).register()
        verify(initializer.gestureCollector, times(2)).register()
        verify(initializer.networkChangesCollector, times(2)).register()
        verify(initializer.httpEventCollector, times(2)).register()
        verify(initializer.powerStateProvider, times(2)).register()
        verify(initializer.spanCollector, times(2)).register()
        verify(initializer.customEventCollector, times(2)).register()
        verify(initializer.periodicSignalStoreScheduler, times(2)).register()
    }
}
