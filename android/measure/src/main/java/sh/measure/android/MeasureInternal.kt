package sh.measure.android

import android.os.Build
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
    val sessionManager by lazy { measureInitializer.sessionManager }
    val timeProvider by lazy { measureInitializer.timeProvider }
    val httpEventCollector by lazy { measureInitializer.httpEventCollector }
    val processInfoProvider by lazy { measureInitializer.processInfoProvider }
    private val userTriggeredEventCollector by lazy { measureInitializer.userTriggeredEventCollector }
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
    private val userDefinedAttribute by lazy { measureInitializer.userDefinedAttribute }
    private val configProvider by lazy { measureInitializer.configProvider }
    private val dataCleanupService by lazy { measureInitializer.dataCleanupService }

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
        dataCleanupService.clearStaleData()
    }

    override fun onColdLaunch() {
        networkChangesCollector.register()
        periodicEventExporter.onColdLaunch()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            appExitCollector.onColdLaunch()
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

    fun putAttribute(key: String, value: Number, store: Boolean) {
        userDefinedAttribute.put(key, value, store)
    }

    fun putAttribute(key: String, value: String, store: Boolean) {
        userDefinedAttribute.put(key, value, store)
    }

    fun putAttribute(key: String, value: Boolean, store: Boolean) {
        userDefinedAttribute.put(key, value, store)
    }

    fun removeAttribute(key: String) {
        userDefinedAttribute.remove(key)
    }

    fun clearAttributes() {
        userDefinedAttribute.clear()
    }

    fun clear() {
        userAttributeProcessor.clearUserId()
        userDefinedAttribute.clear()
    }
}
