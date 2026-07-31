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
        trackANRFromAppExit(database.getPendingAnrs(), currentPid)
        database.finalizePendingAnrs(currentPid)
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun trackANRFromAppExit(pendingAnrs: List<PendingAnr>, currentPid: Int) {
        val appExits: Map<Int, AppExit> = appExitProvider.get() ?: return
        appExits.forEach { (pid, appExit) ->
            val heldAnr = findAnrForExit(pendingAnrs, pid, currentPid)
            if (heldAnr == null) {
                trackAppExit(pid, appExit)
                return@forEach
            }
            // The SDK captured this ANR itself and is holding the event, so the dump
            // enriches it rather than arriving as a second event for one incident.
            // The flush finalizes it either way.
            enrichPendingAnr(heldAnr, appExit)
        }
        sessionManager.markSessionsAppExitTracked()
    }

    /**
     * Finds the held ANR the exit killed the process for. Everything a process held
     * was recorded before it died, so the latest of them is the stall the system
     * acted on.
     *
     * The exit's own timestamp is deliberately not compared against. The system
     * stamps it from the wall clock while a held ANR is stamped from an anchored
     * monotonic clock, so a clock adjustment between the two would drop the match and
     * report one ANR twice, once unenriched and again as an app_exit. Comparing held
     * ANRs to each other stays within a single clock.
     *
     * A pid the live process is reusing cannot be told apart from the dead one it
     * belonged to, so it is left alone until the collision clears.
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
     * Rewrites the held event's body with the system's view of the ANR. A failure
     * here leaves the body as the SDK captured it, which the flush still reports, so
     * an ANR is never lost to a bad write.
     */
    private fun enrichPendingAnr(pendingAnr: PendingAnr, appExit: AppExit) {
        val threadDump = appExit.trace
        if (threadDump.isNullOrEmpty()) {
            return
        }
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
            val enriched = data.copy(art_thread_dump = threadDump, subject = appExit.subject)
            file.writeText(jsonSerializer.encodeToString(ExceptionData.serializer(), enriched))
        }.onFailure {
            logger.log(
                LogLevel.Debug,
                "Failed to enrich ANR(${pendingAnr.eventId}) with the thread dump",
                it,
            )
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
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
}
