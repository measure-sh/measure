package sh.measure.android.anr

import android.os.Build
import android.os.Handler
import sh.measure.android.NativeBridge
import sh.measure.android.SigquitListener
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.mainHandler
import sh.measure.android.utils.ProcessInfoProvider
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Collects ANRs by intercepting SIGQUIT and enriches it with ApplicationExitInfo when
 * available.
 *
 * The two sources arrive at different times. A SIGQUIT is detected while the app is
 * running but ApplicationExitInfo is read on the next launch.
 *
 * [android.app.ApplicationExitInfo] may provide a more detailed stacktrace on the launch
 * after the process died, on API 30 and above. So on those versions the ANR event is
 * tracked as a draft (see [DraftAnrStore]), which keeps it out of batching and cleanup
 * until the dump arrives.
 *
 * On the next launch [AnrExitCollector] reads the system's ANR exit records and matches
 * them to draft ANRs by PID. A match rewrites the draft's body thread dump with the dump.
 *
 * ## Edge cases
 *
 * 1. When app exit is received for a PID which we do not have a corresponding ANR event
 *    for. In that case a new ANR event containing only the thread dump is sent.
 * 2. When an ANR event is a draft, but the subsequent launch does not get any
 *    corresponding [android.app.ApplicationExitInfo]. In that case ANR event is sent
 *    without any modification.
 * 3. When more than one ANR event is a draft for the same PID, which happens if the app
 *    recovers from a stall and stalls again. The system records one app exit per
 *    process, so the thread dump goes to the most recent draft and the rest are
 *    sent without any modification.
 */
internal class AnrCollector(
    private val processInfo: ProcessInfoProvider,
    private val signalProcessor: SignalProcessor,
    private val nativeBridge: NativeBridge,
    private val mainThreadHandler: Handler = mainHandler,
) : SigquitListener {

    private var isRegistered = false

    /**
     * Set from the first SIGQUIT signal until the main thread runs again.
     */
    private val stalled = AtomicBoolean(false)

    fun register() {
        if (isRegistered) return
        nativeBridge.enableAnrReporting(listener = this)
        isRegistered = true
    }

    fun unregister() {
        if (!isRegistered) return
        nativeBridge.disableAnrReporting()
        stalled.set(false)
        isRegistered = false
    }

    override fun onSigquit(timestamp: Long) {
        if (!stalled.compareAndSet(false, true)) {
            return
        }
        mainThreadHandler.post { stalled.set(false) }
        trackAnr(timestamp)
    }

    private fun trackAnr(timestamp: Long) {
        val anrError = AnrError(
            mainThreadHandler.looper.thread,
            timestamp,
            "Application Not Responding for at least 5s",
        )
        signalProcessor.trackCrash(
            data = toMeasureException(anrError),
            timestamp = anrError.timestamp,
            type = EventType.ANR,
            threadName = anrError.thread.name,
            takeScreenshot = true,
            // The system's thread dump for this process can only be read on the next
            // launch, and only from API 30, so the event waits for it there.
            draft = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
        )
    }

    private fun toMeasureException(anr: AnrError): ExceptionData = ExceptionFactory.createMeasureException(
        throwable = anr,
        thread = anr.thread,
        foreground = processInfo.isForegroundProcess(),
    )
}
