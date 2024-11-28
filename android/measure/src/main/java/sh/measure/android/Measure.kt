package sh.measure.android

import android.app.Application
import android.content.Context
import androidx.annotation.VisibleForTesting
import org.jetbrains.annotations.TestOnly
import sh.measure.android.applaunch.LaunchState
import sh.measure.android.config.MeasureConfig
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.okhttp.OkHttpEventCollector
import sh.measure.android.tracing.InternalTrace
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
            measure.start()
        }
    }

    /**
     * Stops tracking. Features like session replay, crash & ANR reporting will not work.
     *
     * @see start to start tracking.
     */
    fun stop() {
        if (isInitialized.get()) {
            measure.stop()
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
     * Track a navigation event.
     *
     * Navigation events are important to understand user journey in the app. Measure SDK
     * automatically collects navigation events from
     * [Jetpack Navigation library](https://developer.android.com/jetpack/androidx/releases/navigation)
     * along with Activity and Fragment lifecycle events. But if your app uses a custom navigation
     * system, you can use this method to track navigation events to have more context when
     * debugging issues.
     *
     * For more details on the automatically collected events, check the documentation.
     *
     * It is recommended to use consistent naming conventions for screen names and namespacing
     * them with relevant context to make it easier to understand the user journey on the Measure
     * Dashboard.
     *
     * Example usage:
     *
     * ```kotlin
     * Measure.trackNavigation("Home", "Login")
     * ```
     *
     * @param to The name of the destination screen or location.
     * @param from The name of the source screen or location. Null by default.
     */
    @JvmStatic
    @JvmOverloads
    @Deprecated(
        message = "This method will be removed in the next version, use trackScreenView instead",
        replaceWith = ReplaceWith("Measure.trackScreenView(screenName)"),
    )
    fun trackNavigation(to: String, from: String? = null) {
        if (isInitialized.get()) {
            measure.trackNavigation(to, from)
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
     * Track a custom event.
     *
     * @param name The name of the event.
     * @param attributes The attributes associated with the event. It can be any key-value pair.
     */
    @JvmStatic
    fun trackEvent(
        name: String,
        attributes: Attributes,
    ) {
        if (isInitialized.get()) {
            measure.trackEvent(name, attributes)
        }
    }

    /**
     * Track a custom event with an attachment.
     *
     * @param name The name of the event.
     * @param attributes The attributes associated with the event. It can be any key-value pair.
     * @param attachment The attachment associated with the event.
     */
    @JvmStatic
    fun trackEvent(
        name: String,
        attachment: MeasureAttachment,
        attributes: Attributes,
    ) {
        if (isInitialized.get()) {
            measure.trackEvent(name, attributes, attachment)
        }
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
        userDefinedAttributes: Attributes,
        attachments: MutableList<Attachment>,
    ) {
        measure.eventProcessor.trackCrash(
            data = data,
            timestamp = timestamp,
            type = type,
            userDefinedAttributes = userDefinedAttributes,
            attachments = attachments,
        )
    }

    @TestOnly
    internal fun simulateAnr(
        data: ExceptionData,
        timestamp: Long,
        userDefinedAttributes: Attributes,
        attachments: MutableList<Attachment>,
    ) {
        measure.eventProcessor.trackCrash(
            type = EventType.ANR,
            data = data,
            timestamp = timestamp,
            userDefinedAttributes = userDefinedAttributes,
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
