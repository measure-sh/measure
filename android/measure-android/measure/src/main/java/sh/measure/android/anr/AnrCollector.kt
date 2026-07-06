package sh.measure.android.anr

import android.os.Looper
import sh.measure.android.AnrListener
import sh.measure.android.NativeBridge
import sh.measure.android.SessionManager
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.mainHandler
import sh.measure.android.storage.Database
import sh.measure.android.utils.ProcessInfoProvider

internal class AnrCollector(
    private val processInfo: ProcessInfoProvider,
    private val signalProcessor: SignalProcessor,
    private val nativeBridge: NativeBridge,
    private val database: Database,
    private val sessionManager: SessionManager,
    private val mainLooper: Looper = mainHandler.looper,
) : AnrListener {

    private var isRegistered = false

    fun register() {
        if (isRegistered) return
        nativeBridge.enableAnrReporting(anrListener = this)
        isRegistered = true
    }

    fun unregister() {
        if (!isRegistered) return
        nativeBridge.disableAnrReporting()
        isRegistered = false
    }

    override fun onAnrDetected(timestamp: Long) {
        val anrError = AnrError(
            mainLooper.thread,
            timestamp,
            "Application Not Responding for at least 5s",
        )
        signalProcessor.trackCrash(
            data = toMeasureException(anrError),
            timestamp = anrError.timestamp,
            type = EventType.ANR,
            takeScreenshot = true,
        )
        // record the ANR against its session so a late-delivered ANR profile
        // can be attributed back to it even after the process is relaunched.
        database.setSessionAnrTime(sessionManager.getSessionId(), anrError.timestamp)
    }

    private fun toMeasureException(anr: AnrError): ExceptionData = ExceptionFactory.createMeasureException(
        throwable = anr,
        thread = anr.thread,
        foreground = processInfo.isForegroundProcess(),
    )
}
