package sh.measure.android.httpurl

import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.Logger
import sh.measure.android.okhttp.HttpData
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal interface HttpUrlConnectionEventCollector {
    fun register()
    fun unregister()
    fun isEnabled(): Boolean
    fun newRecorder(url: String): HttpUrlConnectionRecorder
    fun track(httpData: HttpData)
}

internal class HttpUrlConnectionEventCollectorImpl(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
) : HttpUrlConnectionEventCollector {
    private val enabled = AtomicBoolean(false)

    override fun register() {
        enabled.compareAndSet(false, true)
    }

    override fun unregister() {
        enabled.compareAndSet(true, false)
    }

    override fun isEnabled(): Boolean = enabled.get()

    override fun newRecorder(url: String): HttpUrlConnectionRecorder = HttpUrlConnectionRecorder(this, configProvider, timeProvider, logger, url)

    override fun track(httpData: HttpData) {
        signalProcessor.track(
            type = EventType.HTTP,
            timestamp = timeProvider.now(),
            data = httpData,
        )
    }
}
