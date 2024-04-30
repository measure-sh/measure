package sh.measure.android.anr

import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.TimeProvider

private const val ANR_TIMEOUT_MILLIS = 5000

internal class AnrCollector(
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
    private val timeProvider: TimeProvider,
    private val eventProcessor: EventProcessor,
    private val processInfo: ProcessInfoProvider,
) : ANRWatchDog.ANRListener {
    fun register() {
        ANRWatchDog(
            systemServiceProvider = systemServiceProvider,
            timeoutInterval = ANR_TIMEOUT_MILLIS,
            timeProvider = timeProvider,
            anrListener = this,
        ).start()
    }

    override fun onAppNotResponding(error: AnrError) {
        logger.log(LogLevel.Error, "ANR detected", error)
        eventProcessor.track(
            timestamp = error.timestamp,
            type = EventType.ANR,
            data = toMeasureException(error),
        )
    }

    private fun toMeasureException(anr: AnrError): ExceptionData {
        return ExceptionFactory.createMeasureException(
            throwable = anr,
            handled = false,
            thread = anr.thread,
            foreground = processInfo.isForegroundProcess(),
        )
    }
}
