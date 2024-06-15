package sh.measure.android

import sh.measure.android.applaunch.ColdLaunchListener
import sh.measure.android.lifecycle.ApplicationLifecycleStateListener
import sh.measure.android.logger.LogLevel

/**
 * Initializes the Measure SDK and hides the internal dependencies from public API.
 *
 * All the dependencies are lazy initialized which allows tests to only setup the
 * dependencies required by them and ignore the rest. See [Measure.initForInstrumentationTest]
 * for more details.
 */
internal class MeasureInternal(measureInitializer: MeasureInitializer) :
    ApplicationLifecycleStateListener, ColdLaunchListener {
    val logger by lazy { measureInitializer.logger }
    val eventProcessor by lazy { measureInitializer.eventProcessor }
    val timeProvider by lazy { measureInitializer.timeProvider }
    val okHttpEventCollector by lazy { measureInitializer.okHttpEventCollector }
    private val sessionManager by lazy { measureInitializer.sessionManager }
    private val resumedActivityProvider by lazy { measureInitializer.resumedActivityProvider }
    private val networkClient by lazy { measureInitializer.networkClient }
    private val manifestReader by lazy { measureInitializer.manifestReader }
    private val unhandledExceptionCollector by lazy { measureInitializer.unhandledExceptionCollector }
    private val anrCollector by lazy { measureInitializer.anrCollector }
    private val cpuUsageCollector by lazy { measureInitializer.cpuUsageCollector }
    private val memoryUsageCollector by lazy { measureInitializer.memoryUsageCollector }
    private val componentCallbacksCollector by lazy { measureInitializer.componentCallbacksCollector }
    private val lifecycleCollector by lazy { measureInitializer.lifecycleCollector }
    private val gestureCollector by lazy { measureInitializer.gestureCollector }
    private val appLaunchCollector by lazy { measureInitializer.appLaunchCollector }
    private val networkChangesCollector by lazy { measureInitializer.networkChangesCollector }
    private val appExitCollector by lazy { measureInitializer.appExitCollector }
    private val periodicEventExporter by lazy { measureInitializer.periodicEventExporter }
    private val userAttributeProcessor by lazy { measureInitializer.userAttributeProcessor }

    fun init() {
        logger.log(LogLevel.Debug, "Starting Measure SDK")
        manifestReader.load()?.let {
            if (it.url == null) {
                logger.log(
                    LogLevel.Error,
                    "measure_url is missing in the manifest, skipping initialization",
                )
                return
            }

            if (it.apiKey == null) {
                logger.log(
                    LogLevel.Error,
                    "apiKey is missing in the manifest, skipping initialization",
                )
                return
            }
            networkClient.init(baseUrl = it.url, apiKey = it.apiKey)
        }
        registerCollectors()
        registerCallbacks()
    }

    private fun registerCallbacks() {
        lifecycleCollector.setApplicationLifecycleStateListener(this)
        appLaunchCollector.setColdLaunchListener(this)
    }

    private fun registerCollectors() {
        resumedActivityProvider.register()
        unhandledExceptionCollector.register()
        anrCollector.register()
        lifecycleCollector.register()
        cpuUsageCollector.register()
        memoryUsageCollector.register()
        componentCallbacksCollector.register()
        gestureCollector.register()
        appLaunchCollector.register()
        networkChangesCollector.register()
    }

    override fun onAppForeground() {
        // session manager must be the first to be notified about app foreground to ensure that
        // new session ID (if created) is reflected in all events collected after the launch.
        sessionManager.onAppForeground()
        cpuUsageCollector.resume()
        memoryUsageCollector.resume()
        periodicEventExporter.onAppForeground()
    }

    override fun onAppBackground() {
        sessionManager.onAppBackground()
        cpuUsageCollector.pause()
        memoryUsageCollector.pause()
        periodicEventExporter.onAppBackground()
    }

    override fun onColdLaunch() {
        networkChangesCollector.register()
        periodicEventExporter.onColdLaunch()
        appExitCollector.onColdLaunch()
        sessionManager.clearOldSessions()
    }

    fun setUserId(userId: String) {
        userAttributeProcessor.setUserId(userId)
    }
}
