package sh.measure.android

import android.app.Application
import android.content.Context
import androidx.annotation.VisibleForTesting
import sh.measure.android.Measure.clear
import sh.measure.android.config.MeasureConfig
import sh.measure.android.events.EventProcessor
import sh.measure.android.okhttp.OkHttpEventCollector
import sh.measure.android.utils.TimeProvider
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
     * methods. It is recommended to initialize the SDK as early as possible in the application
     * startup so that exceptions, ANRs and other events can be captured as early as possible.
     *
     * Initializing the SDK multiple times will have no effect.
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
            val application = context.applicationContext as Application
            val initializer = MeasureInitializerImpl(application, defaultConfig = measureConfig)
            measure = MeasureInternal(initializer)
            measure.init()
        }
    }

    /**
     * Sets the user ID for the current user. This user ID will be sent with all the events.
     *
     * Avoid the use of PII (Personally Identifiable Information) in the user ID like
     * email, phone number or any other sensitive information. Instead, use a hashed or anonymized
     * user ID to protect user privacy.
     *
     * Use [clearUserId] to clear the user ID, typically when the user logs out. Note that
     * user ID is not persisted across app launches. Set the user ID each time when
     * the app starts.
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
    fun trackNavigation(to: String, from: String? = null) {
        if (isInitialized.get()) {
            measure.trackNavigation(to, from)
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
     */
    @JvmStatic
    fun trackHandledException(throwable: Throwable) {
        if (isInitialized.get()) {
            measure.trackHandledException(throwable)
        }
    }

    /**
     * Adds an attribute which will be collected along with every event in the session.
     *
     * Attributes are key-value pairs that provide additional context to the events. For example,
     * you can add user's subscription status, plan, or any other relevant information to help
     * debug issues with more context.
     *
     * Note that these attributes are not persisted across app launches. You need to set them
     * each time the app starts.
     *
     * To be able to filter and search on these attributes on the Measure Dashboard, it is
     * recommended to use consistent naming conventions and namespacing them with relevant context.
     *
     * Setting an attribute with different values overrides the previous value.
     */
    fun putAttribute(key: String, value: Number) {
        measure.putAttribute(key, value)
    }

    /**
     * Adds an attribute which will be collected along with every event in the session.
     *
     * Attributes are key-value pairs that provide additional context to the events. For example,
     * you can add user's subscription status, plan, or any other relevant information to help
     * debug issues with more context.
     *
     * Note that these attributes are not persisted across app launches. You need to set them
     * each time the app starts.
     *
     * To be able to filter and search on these attributes on the Measure Dashboard, it is
     * recommended to use consistent naming conventions and namespacing them with relevant context.
     *
     * Setting an attribute with different values overrides the previous value.
     */
    fun putAttribute(key: String, value: String) {
        measure.putAttribute(key, value)
    }

    /**
     * Adds an attribute which will be collected along with every event in the session.
     *
     * Attributes are key-value pairs that provide additional context to the events. For example,
     * you can add user's subscription status, plan, or any other relevant information to help
     * debug issues with more context.
     *
     * Note that these attributes are not persisted across app launches. You need to set them
     * each time the app starts.
     *
     * To be able to filter and search on these attributes on the Measure Dashboard, it is
     * recommended to use consistent naming conventions and namespacing them with relevant context.
     *
     * Setting an attribute with different values overrides the previous value.
     *
     * TODO: consider persisting attributes and clearing them when [clear] is called.
     */
    fun putAttribute(key: String, value: Boolean) {
        measure.putAttribute(key, value)
    }

    /**
     * Removes an attribute with the given key, if previously set by [putAttribute]. No-op if the
     * key is not set.
     */
    fun removeAttribute(key: String) {
        measure.removeAttribute(key)
    }

    /**
     * Clears the attributes set by [putAttribute], if any. No-op if no attributes are set.
     */
    fun clearAttributes() {
        measure.clearAttributes()
    }

    /**
     * Returns all the attributes set by [putAttribute].
     *
     * @param key The key of the attribute.
     * @return The value of the attribute, or null if the attribute does not exist.
     */
    fun getAttribute(key: String): Any? {
        return measure.getAttribute(key)
    }

    /**
     * Returns all the attributes set by [putAttribute], if any.
     *
     * @return A map of all the attributes set by [putAttribute]. Empty map if no attributes are set.
     */
    fun getAttributes(): Map<String, Any?> {
        return measure.getAttributes()
    }

    /**
     * Clears the following data from memory and disk storage, if any:
     * 1. User ID set by [setUserId].
     * 2. Attributes set by [putAttribute].
     *
     * Note that this will not clear the events already collected by the SDK, such events will
     * still be sent to the server without any change.
     */
    fun clear() {
        measure.clear()
    }

    internal fun getEventProcessor(): EventProcessor? {
        if (isInitialized.get()) {
            return measure.eventProcessor
        }
        return null
    }

    internal fun getTimeProvider(): TimeProvider? {
        if (isInitialized.get()) {
            return measure.timeProvider
        }
        return null
    }

    internal fun getOkHttpEventCollector(): OkHttpEventCollector? {
        if (isInitialized.get()) {
            return measure.okHttpEventCollector
        }
        return null
    }

    @VisibleForTesting
    internal fun initForInstrumentationTest(initializer: MeasureInitializer) {
        if (isInitialized.compareAndSet(false, true)) {
            measure = MeasureInternal(initializer)
            // Do not call measure.init() here as the test will set the required dependencies.
        }
    }
}
