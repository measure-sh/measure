package sh.measure.android.storage

import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

internal class PeriodicSignalStoreScheduler(
    private val logger: Logger,
    private val defaultExecutor: MeasureExecutorService,
    private val ioExecutor: MeasureExecutorService,
    private val signalStore: SignalStore,
    private val configProvider: ConfigProvider,
) {

    @Volatile
    private var future: Future<*>? = null

    fun register() {
        if (future != null) {
            return
        }
        try {
            future = defaultExecutor.scheduleAtFixedRate(
                {
                    ioExecutor.submit {
                        signalStore.flush()
                    }
                },
                initialDelay = configProvider.inMemorySignalsQueueFlushRateMs,
                delayMillis = configProvider.inMemorySignalsQueueFlushRateMs,
                TimeUnit.MILLISECONDS,
            )
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to start periodic signal store scheduler", e)
            return
        }
    }

    fun unregister() {
        future?.cancel(false)
        future = null
        ioExecutor.submit {
            signalStore.flush()
        }
    }

    fun onAppBackground() {
        ioExecutor.submit {
            signalStore.flush()
        }
    }
}
