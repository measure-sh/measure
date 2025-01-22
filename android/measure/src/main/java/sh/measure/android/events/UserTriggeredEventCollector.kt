package sh.measure.android.events

import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal interface UserTriggeredEventCollector {
    fun trackHandledException(throwable: Throwable)
    fun trackScreenView(screenName: String)
    fun register()
    fun unregister()
}

internal class UserTriggeredEventCollectorImpl(
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val processInfoProvider: ProcessInfoProvider,
) : UserTriggeredEventCollector {
    private var enabled = AtomicBoolean(false)

    override fun register() {
        enabled.compareAndSet(false, true)
    }

    override fun unregister() {
        enabled.compareAndSet(true, false)
    }

    override fun trackHandledException(throwable: Throwable) {
        if (!enabled.get()) {
            return
        }
        // this is a safe assumption that we're on the same thread as the exception was captured on
        val thread = Thread.currentThread()
        signalProcessor.trackUserTriggered(
            data = ExceptionFactory.createMeasureException(
                throwable = throwable,
                handled = true,
                thread = thread,
                foreground = processInfoProvider.isForegroundProcess(),
            ),
            timestamp = timeProvider.now(),
            type = EventType.EXCEPTION,
        )
    }

    override fun trackScreenView(screenName: String) {
        if (!enabled.get()) {
            return
        }
        signalProcessor.trackUserTriggered(
            data = ScreenViewData(name = screenName),
            timestamp = timeProvider.now(),
            type = EventType.SCREEN_VIEW,
        )
    }
}
