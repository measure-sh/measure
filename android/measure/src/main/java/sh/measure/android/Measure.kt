package sh.measure.android

import android.app.Application
import android.content.Context
import androidx.annotation.VisibleForTesting
import org.jetbrains.annotations.TestOnly
import sh.measure.android.applaunch.LaunchState
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.config.MeasureConfig
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.okhttp.OkHttpEventCollector
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanBuilder
import java.util.concurrent.atomic.AtomicBoolean

/**
 *  The public API to interact with Measure SDK.
 *
 *  It's a singleton class that allows initializing the Measure SDK, and more.
 */
object Measure {
    // Ensures initialization is done only once.
    private val isInitialized = AtomicBoolean(false)

    // Internal instance of Measure SDK.
    private lateinit var measure: MeasureInternal

    /**
     * Initializes the Measure SDK. The SDK must be initialized before using any of the other
     * methods. It is recommended to call this function in Application onCreate.
     *
     * An optional [measureConfig] can be passed to configure the SDK. If not provided, the SDK
     * will use the default configuration. To understand the configuration options available
     * checkout the documentation for [MeasureConfig].
     *
     * @param context The application context.
     * @param measureConfig The configuration for the Measure SDK.
     */
    @JvmStatic
    @JvmOverloads
    fun init(context: Context, measureConfig: MeasureConfig = MeasureConfig()) {
        if (isInitialized.compareAndSet(false, true)) {
            InternalTrace.trace(
                label = { "msr-init" },
                block = {
                    val application = context.applicationContext as Application
                    val initializer =
                        MeasureInitializerImpl(application, inputConfig = measureConfig)
                    measure = MeasureInternal(initializer)
                    storeProcessImportanceState()
                    measure.init()
                },
            )
        }
    }

    /**
     * Starts tracking.
     *
     * @see stop to stop tracking.
     * @see MeasureConfig.autoStart to control whether the SDK should start on init or not.
     */
    fun start() {
        if (isInitialized.get()) {
            InternalTrace.trace(
                label = { "msr-start" },
                block = {
                    measure.start()
                },
            )
        }
    }

    /**
     * Stops tracking. Features like session replay, crash & ANR reporting will not work.
     *
     * @see start to start tracking.
     */
    fun stop() {
        if (isInitialized.get()) {
            InternalTrace.trace(
                label = { "msr-stop" },
                block = {
                    measure.stop()
                },
            )
        }
    }

    /**
     * Sets the user ID for the current user.
     *
     * User Id is persisted across app launches and is used to identify the user across sessions.
     *
     * It is recommended to avoid the use of PII (Personally Identifiable Information) in the
     * user ID like email, phone number or any other sensitive information. Instead, use a hashed
     * or anonymized user ID to protect user privacy.
     *
     * Use [clearUserId] to clear the user ID, typically when the user logs out.
     */
    @JvmStatic
    fun setUserId(userId: String) {
        if (isInitialized.get()) {
            measure.setUserId(userId)
        }
    }

    /**
     * Clears the user ID, if previously set by [setUserId].
     */
    @JvmStatic
    fun clearUserId() {
        if (isInitialized.get()) {
            measure.clearUserId()
        }
    }

    /**
     * Call when a screen is viewed by the user.
     *
     * Measure SDK automatically collects screen view events from the Jetpack Navigation library
     * for AndroidX Fragment and Compose navigation. But if your app uses a custom navigation
     * system, you can use this method to track screen view events to have more context when
     * debugging issues.
     *
     * Example usage:
     * ```kotlin
     * Measure.trackScreenView("Home")
     * ```
     */
    @JvmStatic
    fun trackScreenView(screenName: String) {
        if (isInitialized.get()) {
            measure.trackScreenView(screenName)
        }
    }

    /**
     * Track a handled exception.
     *
     * Handled exceptions are exceptions that are caught and handled in the app code. These do not
     * cause a crash but can, at times, have implication on the user experience. Tracking these
     * exceptions can help in debugging and fixing issues.
     *
     * Example usage:
     *
     * ```kotlin
     * try {
     *    // Code that can throw an exception
     *  } catch (e: Exception) {
     *    Measure.trackHandledException(e)
     *  }
     * ```
     * @param throwable The exception that was caught and handled.
     */
    @JvmStatic
    fun trackHandledException(throwable: Throwable) {
        if (isInitialized.get()) {
            measure.trackHandledException(throwable)
        }
    }

    /**
     * Tracks an event with optional attributes and timestamp.
     *
     * Event Attributes:
     * - Maximum 100 attributes per event
     * - Keys must be strings (max 256 characters)
     * - Values can be one of: boolean, string, integer, long, double
     * - Values of type string have maximum length of 256 characters
     *
     * Usage Notes:
     * - Event names should be clear and consistent to aid in dashboard searches
     * - Attributes can be built using [AttributesBuilder]:
     *   ```kotlin
     *   val attributes = AttributesBuilder()
     *       .put("string", "string")
     *       .put("integer", 10)
     *       .put("long", 100000L)
     *       .put("double", 10.9999)
     *       .put("boolean", false)
     *       .build()
     *   Measure.trackEvent(name = "event-name", attributes = attributes)
     *   ```
     *
     * @param name Name of the event (max 64 characters)
     * @param attributes Key-value pairs providing additional context (defaults to empty map)
     * @param timestamp Optional timestamp for the event, defaults to current time
     */
    fun trackEvent(
        name: String,
        attributes: Map<String, AttributeValue> = emptyMap(),
        timestamp: Long? = null,
    ) {
        if (isInitialized.get()) {
            measure.trackEvent(name, attributes, timestamp)
        }
    }

    /**
     * Starts a new performance tracing span with the specified [name].
     *
     * @param name The name to identify this span. Follow the [naming convention guide](https://github.com/measure-sh/measure/blob/main/docs/android/features/feature_performance_tracing.md#span-names)
     * for consistent naming practices.
     *
     * @return [Span] A new span instance if the SDK is initialized, or an invalid no-op span if not initialized
     */
    fun startSpan(name: String): Span {
        return if (isInitialized.get()) {
            measure.startSpan(name)
        } else {
            Span.invalid()
        }
    }

    /**
     * Starts a new performance tracing span with the specified [name] and start [timestamp].
     *
     * @param name The name to identify this span. Follow the [naming convention guide](https://github.com/measure-sh/measure/blob/main/docs/android/features/feature_performance_tracing.md#span-names)
     * for consistent naming practices.
     * @param timestamp The milliseconds since epoch when the span started. Must be obtained using [getCurrentTime]
     * to minimize clock drift effects.
     *
     * @return [Span] A new span instance if the SDK is initialized, or an invalid no-op span if not initialized
     *
     * Note: Use this method when you need to trace an operation that has already started and you have
     * captured its start time using [getCurrentTime].
     */
    fun startSpan(name: String, timestamp: Long): Span {
        return if (isInitialized.get()) {
            measure.startSpan(name, timestamp = timestamp)
        } else {
            Span.invalid()
        }
    }

    /**
     * Creates a configurable span builder for deferred span creation.
     *
     * @param name The name to identify this span. Follow the [naming convention guide](https://github.com/measure-sh/measure/blob/main/docs/android/features/feature_performance_tracing.md#span-names)
     * for consistent naming practices.
     *
     * @return [SpanBuilder] A builder instance to configure the span if the SDK is initialized,
     * or null if the SDK is not initialized
     *
     * Note: Use this method when you need to create a span without immediately starting it.
     */
    fun createSpanBuilder(name: String): SpanBuilder? {
        return if (isInitialized.get()) {
            measure.createSpan(name)
        } else {
            null
        }
    }

    /**
     * Returns the W3C traceparent header value for the given span.
     *
     * @param span The span to extract the traceparent header value from
     * @return A W3C trace context compliant header value in the format:
     * `{version}-{traceId}-{spanId}-{traceFlags}`
     *
     * Example: `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`
     *
     * @see getTraceParentHeaderKey
     * @see <a href="https://www.w3.org/TR/trace-context/#header-name">W3C Trace Context specification</a>
     *
     * Note: Use this value in the `traceparent` HTTP header when making API calls to enable
     * distributed tracing between your mobile app and backend services.
     */
    fun getTraceParentHeaderValue(span: Span): String {
        return measure.getTraceParentHeaderValue(span)
    }

    /**
     * Returns the W3C traceparent header key/name.
     *
     * @return The standardized header key 'traceparent' that should be used when adding
     * distributed tracing context to HTTP requests
     *
     * @see getTraceParentHeaderValue
     * @see <a href="https://www.w3.org/TR/trace-context/#header-name">W3C Trace Context specification</a>
     */
    fun getTraceParentHeaderKey(): String {
        return measure.getTraceParentHeaderKey()
    }

    /**
     * Returns the current time in milliseconds since epoch using a monotonic clock source.
     *
     * @return The current timestamp in milliseconds since epoch.
     *
     * Note: Use this method to obtain timestamps when creating spans to ensure consistent time
     * measurements and avoid clock drift issues within traces.
     */
    fun getCurrentTime(): Long {
        return if (isInitialized.get()) {
            measure.timeProvider.now()
        } else {
            System.currentTimeMillis()
        }
    }

    /**
     * Returns the session ID for the current session, or null if the SDK has not been initialized.
     *
     * A session represents a continuous period of activity in the app. A new session begins
     * when an app is launched for the first time, or when there's been no activity for a
     * 20-minute period. A single session can continue across multiple app background and
     * foreground events; brief interruptions will not cause a new session to be created.
     *
     * @return session ID if the SDK is initialized, null otherwise.
     */
    fun getSessionId(): String? {
        if (isInitialized.get()) {
            return measure.getSessionId()
        }
        return null
    }

    internal fun getOkHttpEventCollector(): OkHttpEventCollector? {
        if (isInitialized.get()) {
            return try {
                measure.httpEventCollector as OkHttpEventCollector
            } catch (e: ClassCastException) {
                measure.logger.log(
                    LogLevel.Error,
                    "OkHttp is not available as a runtime dependency. Accessing the OkHttpEventCollector is not allowed.",
                    e,
                )
                null
            }
        }
        return null
    }

    @VisibleForTesting
    internal fun initForInstrumentationTest(initializer: MeasureInitializer) {
        if (isInitialized.compareAndSet(false, true)) {
            measure = MeasureInternal(initializer)
            measure.init()
        }
    }

    @TestOnly
    internal fun simulateAppCrash(
        data: ExceptionData,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?>,
        attachments: MutableList<Attachment>,
    ) {
        measure.signalProcessor.trackCrash(
            data = data,
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            attachments = attachments,
        )
    }

    @TestOnly
    internal fun simulateAnr(
        data: ExceptionData,
        timestamp: Long,
        attributes: MutableMap<String, Any?>,
        attachments: MutableList<Attachment>,
    ) {
        measure.signalProcessor.trackCrash(
            type = EventType.ANR,
            data = data,
            timestamp = timestamp,
            attributes = attributes,
            attachments = attachments,
        )
    }

    private fun storeProcessImportanceState() {
        try {
            LaunchState.processImportanceOnInit = measure.processInfoProvider.getProcessImportance()
        } catch (e: Throwable) {
            measure.logger.log(
                LogLevel.Error,
                "Failed to get process importance during initialization.",
                e,
            )
        }
    }
}
