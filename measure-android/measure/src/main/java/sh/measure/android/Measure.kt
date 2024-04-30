package sh.measure.android

import android.app.Application
import android.content.Context
import androidx.annotation.VisibleForTesting
import sh.measure.android.events.EventProcessor
import sh.measure.android.okhttp.OkHttpEventCollector
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The public API of Measure SDK.
 */
object Measure : MeasureApi {
    private val isInitialized = AtomicBoolean(false)
    private lateinit var measure: MeasureInternal

    override fun init(context: Context) {
        if (isInitialized.compareAndSet(false, true)) {
            val application = context.applicationContext as Application
            val initializer = MeasureInitializerImpl(application)
            measure = MeasureInternal(initializer)
            measure.init()
        }
    }

    @VisibleForTesting
    internal fun initForInstrumentationTest(initializer: MeasureInitializer) {
        if (isInitialized.compareAndSet(false, true)) {
            measure = MeasureInternal(initializer)
            // Do not call measure.init() here as the test will set the required dependencies.
        }
    }

    override fun setUserId(userId: String) {
        if (isInitialized.get()) {
            measure.setUserId(userId)
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
}