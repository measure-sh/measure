package sh.measure.android.anr

import sh.measure.android.events.EventTracker
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.networkchange.NetworkInfoProvider
import sh.measure.android.utils.LocaleProvider
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.TimeProvider

private const val ANR_TIMEOUT_MILLIS = 5000

internal class AnrCollector(
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
    private val networkInfoProvider: NetworkInfoProvider,
    private val timeProvider: TimeProvider,
    private val tracker: EventTracker,
    private val localeProvider: LocaleProvider,
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
        tracker.trackAnr(toMeasureException(error))
    }

    private fun toMeasureException(anr: AnrError): MeasureException {
        val networkType = networkInfoProvider.getNetworkType()
        return ExceptionFactory.createMeasureException(
            throwable = anr,
            handled = false,
            timestamp = anr.timestamp,
            thread = anr.thread,
            networkType = networkType,
            networkGeneration = networkInfoProvider.getNetworkGeneration(networkType),
            networkProvider = networkInfoProvider.getNetworkProvider(networkType),
            deviceLocale = localeProvider.getLocale(),
            isAnr = true,
        )
    }
}
