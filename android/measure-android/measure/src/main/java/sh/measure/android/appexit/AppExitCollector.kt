package sh.measure.android.appexit

import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
import sh.measure.android.storage.PendingAnr
import sh.measure.android.utils.ProcessInfoProvider

internal class AppExitCollector(
    private val logger: Logger,
    private val appExitProvider: AppExitProvider,
    private val signalProcessor: SignalProcessor,
    private val sessionManager: SessionManager,
    private val database: Database,
    private val fileStorage: FileStorage,
    private val processInfo: ProcessInfoProvider,
) {

    @RequiresApi(Build.VERSION_CODES.R)
    fun collect() {
        val currentPid = processInfo.getPid()
        val pendingAnrs = database.getPendingAnrs()
        trackANRFromAppExit(pendingAnrs, currentPid)
        movePendingAnrsToEvents(pendingAnrs, currentPid)
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun trackANRFromAppExit(pendingAnrs: List<PendingAnr>, currentPid: Int) {
        val appExits: Map<Int, AppExit> = appExitProvider.get() ?: return
        appExits.forEach { (pid, appExit) ->
            // Limiting tracking of app exit events to just
            // ANRs for now. An exit whose trace could not be read as a
            // thread dump carries nothing worth reporting.
            val threadDump = appExit.threadDump
            if (!appExit.isANR() || threadDump == null) {
                return@forEach
            }
            val heldAnr = findAnrForExit(pendingAnrs, pid, currentPid)
            if (heldAnr == null) {
                trackAppExit(pid, appExit)
                return@forEach
            }
            // The SDK's own event for this ANR is held on device, so the
            // dump enriches it instead of arriving as a separate
            // app_exit. The flush below finalizes it either way.
            enrichPendingAnr(heldAnr, threadDump, appExit.subject)
        }
        sessionManager.markSessionsAppExitTracked()
    }

    /**
     * Finds the ANR event the exit killed the process for. Everything
     * that process held was recorded before it died, so the latest of
     * them is the one the system acted on.
     *
     * The exit's own timestamp is deliberately not compared against:
     * the system stamps it from the wall clock while a held ANR is
     * stamped from [sh.measure.android.utils.TimeProvider], and a clock
     * adjustment between the two would drop the match and report the
     * same ANR twice, once enriched as an anr and again as an app_exit.
     * Comparing held ANRs to each other stays within one clock.
     *
     * A pid the live process is reusing cannot be told apart from the
     * dead one it belonged to, so it is left alone until the pid stops
     * colliding on a later launch.
     */
    private fun findAnrForExit(
        pendingAnrs: List<PendingAnr>,
        pid: Int,
        currentPid: Int,
    ): PendingAnr? {
        if (pid == currentPid) {
            return null
        }
        return pendingAnrs.filter { it.pid == pid }.maxByOrNull { it.timestamp }
    }

    /**
     * Rewrites the held event's body with the system's view of the ANR.
     * A failure here leaves the body as the SDK captured it, which the
     * flush still reports, so the ANR is never lost to a bad write.
     */
    private fun enrichPendingAnr(pendingAnr: PendingAnr, threadDump: String, subject: String?) {
        val file = pendingAnr.filePath?.let(fileStorage::getFile)
        if (file == null) {
            logger.log(LogLevel.Debug, "Missing body for ANR(${pendingAnr.eventId})")
            return
        }
        runCatching {
            val data = jsonSerializer.decodeFromString(
                ExceptionData.serializer(),
                file.readText(),
            )
            val enriched = data.copy(thread_dump = threadDump, subject = subject)
            file.writeText(jsonSerializer.encodeToString(ExceptionData.serializer(), enriched))
        }.onFailure {
            logger.log(
                LogLevel.Debug,
                "Failed to enrich ANR(${pendingAnr.eventId}) with thread dump",
                it,
            )
        }
    }

    private fun trackAppExit(pid: Int, appExit: AppExit) {
        val session = sessionManager.getSessionForAppExit(pid) ?: return
        signalProcessor.trackAppExit(
            appExit,
            // Current time is irrelevant for app exit, using
            // the time at which the app exit actually occurred instead.
            appExit.app_exit_time_ms,
            EventType.APP_EXIT,
            sessionId = session.id,
            sessionStartTime = session.createdAt,
            appVersion = session.appVersion,
            appBuild = session.appBuild,
            threadName = Thread.currentThread().name,
            isSampled = true,
        )
        // backfills the ANR time for a session where the real-time
        // detector's write may have been lost to a fast kill.
        sessionManager.markSessionWithAnr(session.id, appExit.app_exit_time_ms)
    }

    /**
     * Moves every pending ANR held by a dead process into the events
     * table so it exports with this launch's first batch. A dead pid
     * can never produce another exit record, so anything its exit did
     * not enrich above never will be.
     */
    private fun movePendingAnrsToEvents(pendingAnrs: List<PendingAnr>, currentPid: Int) {
        pendingAnrs
            .filter { it.pid != currentPid }
            .forEach { database.movePendingAnrToEvents(it.eventId) }
    }
}
