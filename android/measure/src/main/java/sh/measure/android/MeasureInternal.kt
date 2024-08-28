package sh.measure.android

import android.os.Build
import sh.measure.android.lifecycle.AppLifecycleListener
import sh.measure.android.logger.LogLevel

/**
 * Initializes the Measure SDK and hides the internal dependencies from public API.
 *
 * All the dependencies are lazy initialized which allows tests to only setup the
 * dependencies required by them and ignore the rest. See [Measure.initForInstrumentationTest]
 * for more details.
 */
internal class MeasureInternal(measureInitializer: MeasureInitializer) : AppLifecycleListener {
    val logger by lazy { measureInitializer.logger }
    val eventProcessor by lazy { measureInitializer.eventProcessor }
    val timeProvider by lazy { measureInitializer.timeProvider }
    val httpEventCollector by lazy { measureInitializer.httpEventCollector }
    val processInfoProvider by lazy { measureInitializer.processInfoProvider }
    private val sessionManager by lazy { measureInitializer.sessionManager }
    private val userTriggeredEventCollector by lazy { measureInitializer.userTriggeredEventCollector }
    private val resumedActivityProvider by lazy { measureInitializer.resumedActivityProvider }
    private val networkClient by lazy { measureInitializer.networkClient }
    private val manifestReader by lazy { measureInitializer.manifestReader }
    private val unhandledExceptionCollector by lazy { measureInitializer.unhandledExceptionCollector }
    private val anrCollector by lazy { measureInitializer.anrCollector }
    private val cpuUsageCollector by lazy { measureInitializer.cpuUsageCollector }
    private val memoryUsageCollector by lazy { measureInitializer.memoryUsageCollector }
    private val componentCallbacksCollector by lazy { measureInitializer.componentCallbacksCollector }
    private val appLifecycleManager by lazy { measureInitializer.appLifecycleManager }
    private val activityLifecycleCollector by lazy { measureInitializer.activityLifecycleCollector }
    private val appLifecycleCollector by lazy { measureInitializer.appLifecycleCollector }
    private val gestureCollector by lazy { measureInitializer.gestureCollector }
    private val appLaunchCollector by lazy { measureInitializer.appLaunchCollector }
    private val networkChangesCollector by lazy { measureInitializer.networkChangesCollector }
    private val appExitCollector by lazy { measureInitializer.appExitCollector }
    private val periodicEventExporter by lazy { measureInitializer.periodicEventExporter }
    private val userAttributeProcessor by lazy { measureInitializer.userAttributeProcessor }
    private val configProvider by lazy { measureInitializer.configProvider }
    private val dataCleanupService by lazy { measureInitializer.dataCleanupService }
    private val powerStateProvider by lazy { measureInitializer.powerStateProvider }
    private val customEventCollector by lazy { measureInitializer.customEventCollector }
    private var isStarted: Boolean = false
    private var startLock = Any()

    fun init() {
        logger.log(LogLevel.Debug, "Starting Measure SDK")
        manifestReader.load()?.let {
            if (it.url == null) {
                logger.log(
                    LogLevel.Error,
                    "sh.measure.android.API_URL is missing in the manifest, skipping initialization",
                )
                return
            }

            if (it.apiKey == null) {
                logger.log(
                    LogLevel.Error,
                    "sh.measure.android.API_KEY is missing in the manifest, skipping initialization",
                )
                return
            }
            // This is not very elegant, but can't find a better way to do this given the way the
            // SDK is initialized.
            configProvider.setMeasureUrl(it.url)
            networkClient.init(baseUrl = it.url, apiKey = it.apiKey)
        }
        sessionManager.init()
        registerCallbacks()
        registerAlwaysOnCollectors()
        if (configProvider.autoStart) {
            start()
        }
    }

    fun start() {
        synchronized(startLock) {
            if (!isStarted) {
                registerCollectors()
                isStarted = true
            }
        }
    }

    fun stop() {
        synchronized(startLock) {
            if (isStarted) {
                unregisterCollectors()
                isStarted = false
            }
        }
    }

    private fun registerAlwaysOnCollectors() {
        resumedActivityProvider.register()
        appLaunchCollector.register()
        appLifecycleManager.register()
    }

    private fun registerCallbacks() {
        appLifecycleManager.addListener(this)
    }

    private fun registerCollectors() {
        unhandledExceptionCollector.register()
        anrCollector.register()
        userTriggeredEventCollector.register()
        activityLifecycleCollector.register()
        appLifecycleCollector.register()
        cpuUsageCollector.register()
        memoryUsageCollector.register()
        componentCallbacksCollector.register()
        gestureCollector.register()
        networkChangesCollector.register()
        httpEventCollector.register()
    }

    override fun onAppForeground() {
        // session manager must be the first to be notified about app foreground to ensure that
        // new session ID (if created) is reflected in all events collected after the launch.
        sessionManager.onAppForeground()
        synchronized(startLock) {
            if (isStarted) {
                powerStateProvider.register()
                cpuUsageCollector.resume()
                memoryUsageCollector.resume()
                periodicEventExporter.onAppForeground()
            }
        }
    }

    override fun onAppBackground() {
        sessionManager.onAppBackground()
        synchronized(startLock) {
            if (isStarted) {
                cpuUsageCollector.pause()
                memoryUsageCollector.pause()
                periodicEventExporter.onAppBackground()
                powerStateProvider.unregister()
                dataCleanupService.clearStaleData()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    appExitCollector.collect()
                }
            }
        }
    }

    fun setUserId(userId: String) {
        userAttributeProcessor.setUserId(userId)
    }

    fun clearUserId() {
        userAttributeProcessor.clearUserId()
    }

    @Deprecated("Use trackScreenView instead")
    fun trackNavigation(to: String, from: String?) {
        userTriggeredEventCollector.trackNavigation(to, from)
    }

    fun trackScreenView(screenName: String) {
        userTriggeredEventCollector.trackScreenView(screenName)
    }

    fun trackHandledException(throwable: Throwable) {
        userTriggeredEventCollector.trackHandledException(throwable)
    }

    fun trackEvent(
        name: String,
        attributes: Attributes,
        attachment: MeasureAttachment? = null,
    ) {
        customEventCollector.trackEvent(name, attributes, attachment)
    }

    fun clear() {
        userAttributeProcessor.clearUserId()
    }

    private fun unregisterCollectors() {
        unhandledExceptionCollector.unregister()
        anrCollector.unregister()
        activityLifecycleCollector.unregister()
        appLifecycleCollector.register()
        cpuUsageCollector.pause()
        memoryUsageCollector.pause()
        componentCallbacksCollector.unregister()
        gestureCollector.unregister()
        networkChangesCollector.unregister()
        periodicEventExporter.unregister()
        userTriggeredEventCollector.unregister()
        httpEventCollector.unregister()
    }
}
