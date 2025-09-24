package sh.measure.android.appexit

import android.app.ApplicationExitInfo.REASON_ANR
import android.app.ApplicationExitInfo.REASON_CRASH
import android.app.ApplicationExitInfo.REASON_CRASH_NATIVE
import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

internal class AppExitCollector(
    private val logger: Logger,
    private val appExitProvider: AppExitProvider,
    private val ioExecutor: MeasureExecutorService,
    private val database: Database,
    private val signalProcessor: SignalProcessor,
    private val sessionManager: SessionManager,
) {
    // Prevents app exit from being processed multiple times
    private val tracked = AtomicBoolean(false)

    @RequiresApi(Build.VERSION_CODES.R)
    fun collect() {
        if (!tracked.getAndSet(true)) {
            trackAppExits()
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun trackAppExits() {
        try {
            ioExecutor.submit {
                val appExitsMap: Map<Int, AppExit> = appExitProvider.get() ?: return@submit
                val trackedSessions = mutableListOf<Session>()
                appExitsMap.forEach {
                    val pid = it.key
                    val appExit = it.value
                    val session = getSessionForAppExit(pid)
                    if (session != null) {
                        signalProcessor.trackAppExit(
                            appExit,
                            // Current time is irrelevant for app exit, using
                            // the time at which the app exit actually occurred instead.
                            appExit.app_exit_time_ms,
                            EventType.APP_EXIT,
                            sessionId = session.id,
                            appVersion = session.appVersion,
                            appBuild = session.appBuild,
                            threadName = Thread.currentThread().name,
                        )
                        if (isReasonCrashOrAnr(appExit)) {
                            sessionManager.markCrashedSession(session.id)
                        }
                        trackedSessions.add(session)
                    }
                }
                trackedSessions.sortByDescending { it.createdAt }
                val clearSessionsBefore = trackedSessions.first().createdAt
                sessionManager.clearAppExitSessionsBefore(clearSessionsBefore)
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Unable to track app exit events", e)
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun isReasonCrashOrAnr(appExit: AppExit): Boolean {
        val reasonId = appExit.reasonId
        return reasonId == REASON_CRASH || reasonId == REASON_ANR || reasonId == REASON_CRASH_NATIVE
    }

    private fun getSessionForAppExit(pid: Int): Session? {
        return database.getSessionForAppExit(pid)
    }

    internal data class Session(
        val id: String,
        val pid: Int,
        val createdAt: Long,
        val appVersion: String?,
        val appBuild: String?,
    )
}
