package sh.measure.android.anr

import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.storage.DraftAnr
import sh.measure.android.storage.SessionRecord
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.ProcessInfoProvider

internal class AnrExitCollector(
    private val anrExit: AnrExit,
    private val draftAnrStore: DraftAnrStore,
    private val signalProcessor: SignalProcessor,
    private val sessionManager: SessionManager,
    private val processInfo: ProcessInfoProvider,
) {

    @RequiresApi(Build.VERSION_CODES.R)
    fun collect() {
        InternalTrace.trace(
            { "msr-collect-anr-exits" },
            {
                val currentPid = processInfo.getPid()
                reconcileAnrExits(draftAnrStore.getAll(), currentPid)
                draftAnrStore.finalize(currentPid)
            },
        )
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun reconcileAnrExits(draftAnrs: List<DraftAnr>, currentPid: Int) {
        val exits: List<AnrExitData> = anrExit.get() ?: return
        exits.forEach { exit ->
            val draftAnr = findAnrForExit(draftAnrs, exit.pid, currentPid)
            if (draftAnr == null) {
                val session = sessionManager.getSessionForAppExit(exit.pid) ?: return@forEach
                trackAnrFromExit(anrExit.withTrace(exit), session)
                return@forEach
            }
            val exitWithTrace = anrExit.withTrace(exit)
            val threadDump = exitWithTrace.threadDump
            if (!threadDump.isNullOrEmpty()) {
                draftAnrStore.mergeThreadDump(draftAnr, threadDump, exitWithTrace.subject)
            }
        }
    }

    /**
     * Finds the pending ANR the exit killed the process for, matching on pid alone.
     * Everything a process held was recorded before it died, so the latest of them
     * is the stall the system acted on.
     *
     * Timestamps are not compared: the exit carries the system's wall clock while a
     * pending ANR carries an anchored monotonic clock, so a clock adjustment between
     * the two would drop a valid match and report the ANR twice. A pid the live
     * process is reusing is skipped until the collision clears.
     */
    private fun findAnrForExit(
        draftAnrs: List<DraftAnr>,
        pid: Int,
        currentPid: Int,
    ): DraftAnr? {
        if (pid == currentPid) {
            return null
        }
        return draftAnrs.filter { it.pid == pid }.maxByOrNull { it.timestamp }
    }

    /**
     * Reports an ANR the SDK never held, one the live SIGQUIT path missed or lost
     * to a kill that landed first. The system's thread dump stands in for the
     * stacktrace, so the event carries no exception of its own.
     */
    @RequiresApi(Build.VERSION_CODES.R)
    private fun trackAnrFromExit(exit: AnrExitData, session: SessionRecord) {
        signalProcessor.trackForSession(
            ExceptionData(
                exceptions = emptyList(),
                threads = emptyList(),
                foreground = exit.foreground,
                art_thread_dump = exit.threadDump,
                subject = exit.subject,
            ),
            // The ANR belongs to the moment the system killed the process,
            // not to this launch.
            exit.timestampMs,
            EventType.ANR,
            sessionId = session.id,
            sessionStartTime = session.createdAt,
            appVersion = session.appVersion,
            appBuild = session.appBuild,
        )
        // backfills the ANR time for a session where the live SIGQUIT path's
        // write may have been lost to a fast kill.
        sessionManager.markSessionWithAnr(session.id, exit.timestampMs)
    }
}
