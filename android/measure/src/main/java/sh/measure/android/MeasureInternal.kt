package sh.measure.android

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.os.Build
import androidx.annotation.MainThread
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.MsrShakeListener
import sh.measure.android.config.ClientInfo
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
    private val internalSignalCollector by lazy { measureInitializer.internalSignalCollector }
    private var isStarted: Boolean = false
    private var startLock = Any()

    fun init(clientInfo: ClientInfo? = null) {
        if (!setupNetworkClient(clientInfo)) {
            return
        }

        // initialize a session
        sessionManager.init()

        // setup lifecycle state
        appLifecycleManager.addListener(this)
        resumedActivityProvider.register()
        appLifecycleManager.register()

        // always collect app launch events
        appLaunchCollector.register()

        // start SDK
        if (configProvider.autoStart) {
            start()
        }

        logger.log(LogLevel.Debug, "Initialization complete")
    }

    fun start() {
        synchronized(startLock) {
            if (!isStarted) {
                registerCollectors()
                isStarted = true
                logger.log(LogLevel.Debug, "Started")
            }
        }
    }

    fun stop() {
        synchronized(startLock) {
            if (isStarted) {
                unregisterCollectors()
                isStarted = false
                logger.log(LogLevel.Debug, "Stopped")
            }
        }
    }

    // Validates and initializes the network client, returns true if initialization was successful,
    // false otherwise.
    private fun setupNetworkClient(clientInfo: ClientInfo?): Boolean {
        return if (clientInfo != null) {
            initializeWithCredentials(clientInfo.apiUrl, clientInfo.apiKey)
        } else {
            initializeFromManifest()
        }
    }

    private fun validateApiCredentials(apiUrl: String?, apiKey: String?): String? {
        return when {
            apiUrl.isNullOrEmpty() -> "API URL is missing"
            apiKey.isNullOrEmpty() -> "API Key is missing"
            !apiKey.startsWith("msrsh") -> "invalid API Key"
            else -> null
        }
    }

    private fun initializeFromManifest(): Boolean {
        val manifest = manifestReader.load()
        if (manifest == null) {
            return false
        }

        return initializeWithCredentials(manifest.url, manifest.apiKey)
    }

    private fun initializeWithCredentials(apiUrl: String?, apiKey: String?): Boolean {
        val validationError = validateApiCredentials(apiUrl, apiKey)

        return if (validationError != null) {
            logger.log(
                LogLevel.Error,
                "Failed to initialize Measure SDK, $validationError",
            )
            false
        } else {
            configProvider.setMeasureUrl(apiUrl!!)
            networkClient.init(baseUrl = apiUrl, apiKey = apiKey!!)
            true
        }
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
        } catch (_: IllegalArgumentException) {
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

    fun setShakeListener(shakeListener: MsrShakeListener?) {
        shakeBugReportCollector.setShakeListener(shakeListener)
    }

    fun internalTrackEvent(
        data: MutableMap<String, Any?>,
        type: String,
        timestamp: Long,
        attributes: MutableMap<String, Any?>,
        userDefinedAttrs: MutableMap<String, AttributeValue>,
        attachments: MutableList<MsrAttachment>,
        userTriggerEvent: Boolean,
        sessionId: String?,
        threadName: String?,
    ) {
        if (isStarted) {
            internalSignalCollector.trackEvent(
                data = data,
                type = type,
                timestamp = timestamp,
                attributes = attributes,
                userDefinedAttrs = userDefinedAttrs,
                attachments = attachments,
                userTriggered = userTriggerEvent,
                sessionId = sessionId,
                threadName = threadName,
            )
        }
    }

    fun internalTrackSpan(
        name: String,
        traceId: String,
        spanId: String,
        parentId: String?,
        startTime: Long,
        endTime: Long,
        duration: Long,
        status: Int,
        attributes: MutableMap<String, Any?>,
        userDefinedAttrs: Map<String, Any>,
        checkpoints: Map<String, Long>,
        hasEnded: Boolean,
        isSampled: Boolean,
    ) {
        if (isStarted) {
            internalSignalCollector.trackSpan(
                name = name,
                traceId = traceId,
                spanId = spanId,
                parentId = parentId,
                startTime = startTime,
                endTime = endTime,
                duration = duration,
                status = status,
                attributes = attributes,
                userDefinedAttrs = userDefinedAttrs,
                checkpoints = checkpoints,
                hasEnded = hasEnded,
                isSampled = isSampled,
            )
        }
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
