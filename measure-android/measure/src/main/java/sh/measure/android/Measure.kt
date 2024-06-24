package sh.measure.android

import android.app.Application
import android.content.Context
import androidx.annotation.VisibleForTesting
import sh.measure.android.config.MeasureConfig
import sh.measure.android.events.EventProcessor
import sh.measure.android.okhttp.OkHttpEventCollector
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The public API of Measure SDK.
 */
object Measure {
    private val isInitialized = AtomicBoolean(false)
    private lateinit var measure: MeasureInternal

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

    @JvmStatic
    fun setUserId(userId: String) {
        if (isInitialized.get()) {
            measure.setUserId(userId)
        }
    }

    @JvmStatic
    @JvmOverloads
    fun trackNavigation(to: String, from: String? = null) {
        if (isInitialized.get()) {
            measure.trackNavigation(to, from)
        }
    }

    @JvmStatic
    fun trackHandledException(throwable: Throwable) {
        if (isInitialized.get()) {
            measure.trackHandledException(throwable)
        }
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
