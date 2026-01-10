package sh.measure.android

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.os.Build
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.MsrShakeListener
import sh.measure.android.config.ClientInfo
import sh.measure.android.events.EventType
import sh.measure.android.lifecycle.AppLifecycleListener
import sh.measure.android.logger.LogLevel
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanBuilder
import sh.measure.android.utils.AttachmentHelper

/**
 * Initializes the Measure SDK and hides the internal dependencies from public API.
 */
internal class MeasureInternal(private val measure: MeasureInitializer) : AppLifecycleListener {
    val timeProvider = measure.timeProvider
    val processInfoProvider = measure.processInfoProvider
    val logger = measure.logger
    val bugReportCollector = measure.bugReportCollector
    val httpEventCollector = measure.httpEventCollector
    val signalProcessor = measure.signalProcessor

    @Volatile
    private var isStarted: Boolean = false
    private val lock = Any()

    fun init(clientInfo: ClientInfo? = null) {
        if (!setupNetworkClient(clientInfo)) {
            return
        }

        // start a session
        val sessionId = measure.sessionManager.init()

        // All events are processed on a single thread in a queue.
        // So, the first event will always be a session start event
        // as we initialize all other collectors after this event
        // is triggered.
        measure.signalProcessor.track(
            SessionStartData,
            timestamp = measure.timeProvider.now(),
            type = EventType.SESSION_START,
            sessionId = sessionId,
            // always sample session start event
            isSampled = true,
        )

        // setup lifecycle state
        measure.resumedActivityProvider.register()
        measure.appLifecycleManager.addListener(this)
        measure.appLifecycleManager.register()

        // delaying this can lead to initial
        // launch events to not get collected
        measure.appLaunchCollector.register()

        // enable crash tracking early
        if (measure.configProvider.autoStart) {
            start()
        }

        measure.configLoader.loadDynamicConfig { config ->
            // Callback on msr-io thread
            if (config != null) {
                measure.configProvider.setDynamicConfig(config)
            }
            measure.sessionManager.onConfigLoaded()
            measure.spanProcessor.onConfigLoaded()
            measure.appLaunchCollector.onConfigLoaded()
            mainHandler.post {
                measure.cpuUsageCollector.onConfigLoaded()
                measure.memoryUsageCollector.onConfigLoaded()
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Must be called on msr-io thread
                measure.appExitCollector.collect()
            }

            // must be called last
            measure.exporter.export()
        }
        measure.logger.log(LogLevel.Debug, "Initialization complete")
    }

    fun start() {
        synchronized(lock) {
            if (isStarted) {
                return
            }
            enableCrashTracking()
            registerCollectors()
            isStarted = true
        }
    }

    fun stop() {
        synchronized(lock) {
            if (!isStarted) {
                return
            }
            disableCrashTracking()
            unregisterCollectors()
            isStarted = false
        }
    }

    override fun onAppForeground() {
        // session manager must be the first to be notified about app foreground to ensure that
        // new session ID (if created) is reflected in all events collected after the launch.
        measure.sessionManager.onAppForeground()
        if (isStarted) {
            resumeCollectorsOnForeground()
        }
    }

    override fun onAppBackground() {
        measure.sessionManager.onAppBackground()
        if (isStarted) {
            measure.periodicSignalStoreScheduler.onAppBackground()
            pauseCollectorsOnBackground()
            measure.exporter.export()
            measure.dataCleanupService.cleanup()
        }
    }

    fun setUserId(userId: String) {
        measure.userAttributeProcessor.setUserId(userId)
    }

    fun clearUserId() {
        measure.userAttributeProcessor.clearUserId()
    }

    fun trackScreenView(screenName: String, attributes: Map<String, AttributeValue>) {
        measure.userTriggeredEventCollector.trackScreenView(screenName, attributes)
    }

    fun trackHandledException(throwable: Throwable, attributes: Map<String, AttributeValue>) {
        measure.userTriggeredEventCollector.trackHandledException(throwable, attributes)
    }

    fun createSpan(name: String): SpanBuilder? = measure.spanCollector.createSpan(name)

    fun startSpan(name: String, timestamp: Long? = null): Span = measure.spanCollector.startSpan(name, timestamp)

    fun getTraceParentHeaderValue(span: Span): String = measure.spanCollector.getTraceParentHeaderValue(span)

    fun getTraceParentHeaderKey(): String = measure.spanCollector.getTraceParentHeaderKey()

    fun getSessionId(): String? = try {
        measure.sessionManager.getSessionId()
    } catch (_: IllegalArgumentException) {
        null
    }

    fun trackEvent(name: String, attributes: Map<String, AttributeValue>, timestamp: Long?) {
        measure.customEventCollector.trackEvent(name, attributes, timestamp)
    }

    fun startBugReportFlow(
        takeScreenshot: Boolean,
        attributes: MutableMap<String, AttributeValue>,
    ) {
        measure.bugReportCollector.startBugReportFlow(takeScreenshot, attributes)
    }

    fun trackBugReport(
        description: String,
        screenshots: List<MsrAttachment>,
        attributes: MutableMap<String, AttributeValue>,
    ) {
        measure.userTriggeredEventCollector.trackBugReport(description, screenshots, attributes)
    }

    fun captureScreenshot(
        activity: Activity,
        onComplete: (attachment: MsrAttachment) -> Unit,
        onError: (() -> Unit)?,
    ) {
        AttachmentHelper(
            measure.logger,
            measure.executorServiceRegistry.ioExecutor(),
            measure.configProvider,
        ).captureScreenshot(activity, onComplete, onError)
    }

    fun takeLayoutSnapshot(
        activity: Activity,
        onComplete: (attachment: MsrAttachment) -> Unit,
        onError: (() -> Unit)?,
    ) {
        AttachmentHelper(
            measure.logger,
            measure.executorServiceRegistry.ioExecutor(),
            measure.configProvider,
        ).captureLayoutSnapshot(activity, onComplete, onError)
    }

    fun imageUriToAttachment(
        context: Context,
        uri: Uri,
        onComplete: (attachment: MsrAttachment) -> Unit,
        onError: () -> Unit,
    ) {
        AttachmentHelper(
            measure.logger,
            measure.executorServiceRegistry.ioExecutor(),
            measure.configProvider,
        ).imageUriToAttachment(
            context,
            uri,
            onComplete,
            onError,
        )
    }

    fun setShakeListener(shakeListener: MsrShakeListener?) {
        measure.shakeBugReportCollector.setShakeListener(shakeListener)
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
        measure.internalSignalCollector.trackEvent(
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
        userDefinedAttrs: MutableMap<String, Any?>,
        checkpoints: Map<String, Long>,
        hasEnded: Boolean,
        isSampled: Boolean,
    ) {
        measure.internalSignalCollector.trackSpan(
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

    fun getAttachmentDirectory(): String? = measure.fileStorage.getAttachmentDirectory()

    fun trackHttpEvent(
        url: String,
        method: String,
        startTime: Long,
        endTime: Long,
        statusCode: Int?,
        error: Exception?,
        requestHeaders: MutableMap<String, String>?,
        responseHeaders: MutableMap<String, String>?,
        requestBody: String?,
        responseBody: String?,
        client: String,
    ) {
        measure.userTriggeredEventCollector.trackHttp(
            url,
            method,
            startTime,
            endTime,
            client,
            statusCode,
            error?.javaClass?.name,
            error?.message,
            requestHeaders,
            responseHeaders,
            requestBody,
            responseBody,
        )
    }

    private fun setupNetworkClient(clientInfo: ClientInfo?): Boolean = if (clientInfo != null) {
        initializeWithCredentials(clientInfo.apiUrl, clientInfo.apiKey)
    } else {
        initializeFromManifest()
    }

    private fun validateApiCredentials(apiUrl: String?, apiKey: String?): String? = when {
        apiUrl.isNullOrEmpty() -> "API URL is missing"
        apiKey.isNullOrEmpty() -> "API Key is missing"
        !apiKey.startsWith("msrsh") -> "invalid API Key"
        else -> null
    }

    private fun initializeFromManifest(): Boolean {
        val manifest = measure.manifestReader.load()
        if (manifest == null) {
            return false
        }

        return initializeWithCredentials(manifest.url, manifest.apiKey)
    }

    private fun initializeWithCredentials(apiUrl: String?, apiKey: String?): Boolean {
        val validationError = validateApiCredentials(apiUrl, apiKey)

        return if (validationError != null) {
            measure.logger.log(
                LogLevel.Error,
                "Failed to initialize Measure SDK, $validationError",
            )
            false
        } else {
            measure.configProvider.setMeasureUrl(apiUrl!!)
            measure.networkClient.init(baseUrl = apiUrl, apiKey = apiKey!!)
            true
        }
    }

    private fun registerCollectors() {
        measure.userTriggeredEventCollector.register()
        measure.activityLifecycleCollector.register()
        measure.appLifecycleCollector.register()
        measure.cpuUsageCollector.register()
        measure.memoryUsageCollector.register()
        measure.componentCallbacksCollector.register()
        measure.gestureCollector.register()
        measure.networkChangesCollector.register()
        measure.httpEventCollector.register()
        measure.powerStateProvider.register()
        measure.spanCollector.register()
        measure.customEventCollector.register()
        measure.periodicSignalStoreScheduler.register()
    }

    private fun unregisterCollectors() {
        measure.userTriggeredEventCollector.unregister()
        measure.activityLifecycleCollector.unregister()
        measure.appLifecycleCollector.unregister()
        measure.cpuUsageCollector.unregister()
        measure.memoryUsageCollector.unregister()
        measure.componentCallbacksCollector.unregister()
        measure.gestureCollector.unregister()
        measure.networkChangesCollector.unregister()
        measure.httpEventCollector.unregister()
        measure.powerStateProvider.unregister()
        measure.spanCollector.unregister()
        measure.customEventCollector.unregister()
        measure.periodicSignalStoreScheduler.unregister()
    }

    private fun pauseCollectorsOnBackground() {
        measure.cpuUsageCollector.unregister()
        measure.memoryUsageCollector.unregister()
    }

    private fun resumeCollectorsOnForeground() {
        measure.cpuUsageCollector.register()
        measure.memoryUsageCollector.register()
    }

    private fun enableCrashTracking() {
        measure.unhandledExceptionCollector.register()
        measure.anrCollector.register()
    }

    private fun disableCrashTracking() {
        measure.unhandledExceptionCollector.unregister()
        measure.anrCollector.unregister()
    }
}
