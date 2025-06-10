package sh.measure.android.okhttp

import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.Logger
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.isClassAvailable

/**
 * Factory for creating [HttpEventCollector] instances. This is required to
 * avoid accessing [OkHttpEventCollectorImpl] when OkHttp is not available as a runtime dependency.
 */
internal class HttpEventCollectorFactory(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
) {
    fun create(): HttpEventCollector {
        return if (isClassAvailable("okhttp3.OkHttpClient")) {
            OkHttpEventCollectorImpl(logger, signalProcessor, timeProvider, configProvider)
        } else {
            NoOpHttpEventCollector()
        }
    }
}
