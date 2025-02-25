package sh.measure.android

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.os.Build
import androidx.annotation.MainThread
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.MsrShakeListener
import sh.measure.android.lifecycle.AppLifecycleListener
import sh.measure.android.logger.LogLevel
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanBuilder
import sh.measure.android.utils.AttachmentHelper

/**
 * Initializes the Measure SDK and hides the internal dependencies from public API.
 *
 * All the dependencies are lazy initialized which allows tests to only setup the
 * dependencies required by them and ignore the rest. See [Measure.initForInstrumentationTest]
 * for more details.
 */
internal class MeasureInternal(measureInitializer: MeasureInitializer) : AppLifecycleListener {
    val logger by lazy { measureInitializer.logger }
    val signalProcessor by lazy { measureInitializer.signalProcessor }
    val httpEventCollector by lazy { measureInitializer.httpEventCollector }
    val processInfoProvider by lazy { measureInitializer.processInfoProvider }
    val timeProvider by lazy { measureInitializer.timeProvider }
    val bugReportCollector by lazy { measureInitializer.bugReportCollector }
    private val spanCollector by lazy { measureInitializer.spanCollector }
    private val customEventCollector by lazy { measureInitializer.customEventCollector }
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
    private val periodicExporter by lazy { measureInitializer.periodicExporter }
    private val userAttributeProcessor by lazy { measureInitializer.userAttributeProcessor }
    private val configProvider by lazy { measureInitializer.configProvider }
    private val dataCleanupService by lazy { measureInitializer.dataCleanupService }
    private val powerStateProvider by lazy { measureInitializer.powerStateProvider }
    private val periodicSignalStoreScheduler by lazy { measureInitializer.periodicSignalStoreScheduler }
    private val executorServiceRegistry by lazy { measureInitializer.executorServiceRegistry }
    private val shakeBugReportCollector by lazy { measureInitializer.shakeBugReportCollector }
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
        powerStateProvider.register()
        periodicExporter.resume()
        spanCollector.register()
        customEventCollector.register()
        periodicSignalStoreScheduler.register()
    }

    override fun onAppForeground() {
        // session manager must be the first to be notified about app foreground to ensure that
        // new session ID (if created) is reflected in all events collected after the launch.
        sessionManager.onAppForeground()
        synchronized(startLock) {
            if (isStarted) {
                powerStateProvider.register()
                networkChangesCollector.register()
                cpuUsageCollector.resume()
                memoryUsageCollector.resume()
                periodicExporter.resume()
            }
        }
    }

    override fun onAppBackground() {
        sessionManager.onAppBackground()
        synchronized(startLock) {
            if (isStarted) {
                cpuUsageCollector.pause()
                memoryUsageCollector.pause()
                periodicExporter.pause()
                powerStateProvider.unregister()
                networkChangesCollector.unregister()
                periodicSignalStoreScheduler.onAppBackground()
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

    fun trackScreenView(screenName: String) {
        userTriggeredEventCollector.trackScreenView(screenName)
    }

    fun trackHandledException(throwable: Throwable) {
        userTriggeredEventCollector.trackHandledException(throwable)
    }

    fun createSpan(name: String): SpanBuilder? {
        return spanCollector.createSpan(name)
    }

    fun startSpan(name: String, timestamp: Long? = null): Span {
        return spanCollector.startSpan(name, timestamp)
    }

    fun getTraceParentHeaderValue(span: Span): String {
        return spanCollector.getTraceParentHeaderValue(span)
    }

    fun getTraceParentHeaderKey(): String {
        return spanCollector.getTraceParentHeaderKey()
    }

    fun getSessionId(): String? {
        return try {
            sessionManager.getSessionId()
        } catch (e: IllegalArgumentException) {
            return null
        }
    }

    fun trackEvent(name: String, attributes: Map<String, AttributeValue>, timestamp: Long?) {
        customEventCollector.trackEvent(name, attributes, timestamp)
    }

    fun startBugReportFlow(
        takeScreenshot: Boolean,
        attributes: MutableMap<String, AttributeValue>,
    ) {
        bugReportCollector.startBugReportFlow(takeScreenshot, attributes)
    }

    fun trackBugReport(
        description: String,
        screenshots: List<MsrAttachment>,
        attributes: MutableMap<String, AttributeValue>,
    ) {
        userTriggeredEventCollector.trackBugReport(description, screenshots, attributes)
    }

    @MainThread
    fun captureScreenshot(
        activity: Activity,
        onComplete: (attachment: MsrAttachment) -> Unit,
        onError: (() -> Unit)?,
    ) {
        AttachmentHelper(
            logger,
            executorServiceRegistry.ioExecutor(),
            configProvider,
        ).captureScreenshot(activity, onComplete, onError)
    }

    @MainThread
    fun takeLayoutSnapshot(
        activity: Activity,
        onComplete: (attachment: MsrAttachment) -> Unit,
        onError: (() -> Unit)?,
    ) {
        AttachmentHelper(
            logger,
            executorServiceRegistry.ioExecutor(),
            configProvider,
        ).captureLayoutSnapshot(activity, onComplete, onError)
    }

    fun imageUriToAttachment(
        context: Context,
        uri: Uri,
        onComplete: (attachment: MsrAttachment) -> Unit,
        onError: () -> Unit,
    ) {
        AttachmentHelper(
            logger,
            executorServiceRegistry.ioExecutor(),
            configProvider,
        ).imageUriToAttachment(
            context,
            uri,
            onComplete,
            onError,
        )
    }

    fun enableShakeToLaunchBugReport(takeScreenshot: Boolean) {
        shakeBugReportCollector.enableAutoLaunch(takeScreenshot)
    }

    fun disableShakeToLaunchBugReport() {
        shakeBugReportCollector.disableAutoLaunch()
    }

    fun setShakeListener(shakeListener: MsrShakeListener?) {
        shakeBugReportCollector.setShakeListener(shakeListener)
    }

    fun isShakeToLaunchBugReportEnabled(): Boolean {
        return shakeBugReportCollector.isShakeToLaunchBugReportEnabled()
    }

    private fun unregisterCollectors() {
        unhandledExceptionCollector.unregister()
        anrCollector.unregister()
        userTriggeredEventCollector.unregister()
        activityLifecycleCollector.unregister()
        appLifecycleCollector.unregister()
        cpuUsageCollector.pause()
        memoryUsageCollector.pause()
        componentCallbacksCollector.unregister()
        gestureCollector.unregister()
        networkChangesCollector.unregister()
        httpEventCollector.unregister()
        powerStateProvider.unregister()
        periodicExporter.unregister()
        spanCollector.unregister()
        customEventCollector.unregister()
        periodicSignalStoreScheduler.unregister()
    }
}
