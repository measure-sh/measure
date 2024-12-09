package sh.measure.android.anr

import android.os.Looper
import sh.measure.android.AnrListener
import sh.measure.android.NativeBridge
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.mainHandler
import sh.measure.android.utils.ProcessInfoProvider

internal class AnrCollector(
    private val logger: Logger,
    private val processInfo: ProcessInfoProvider,
    private val signalProcessor: SignalProcessor,
    private val nativeBridge: NativeBridge,
    private val mainLooper: Looper = mainHandler.looper,
) : AnrListener {

    fun register() {
        logger.log(LogLevel.Debug, "Registering ANR collector V2")
        nativeBridge.enableAnrReporting(anrListener = this)
    }

    override fun onAnrDetected(timestamp: Long) {
        logger.log(LogLevel.Info, "ANR detected at $timestamp")
        val anrError = AnrError(
            mainLooper.thread,
            timestamp,
            "Application Not Responding for at least 5s",
        )
        signalProcessor.trackCrash(
            timestamp = anrError.timestamp,
            type = EventType.ANR,
            data = toMeasureException(anrError),
        )
    }

    @Suppress("unused")
    fun unregister() {
        nativeBridge.disableAnrReporting()
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
