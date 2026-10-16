package sh.measure.android.appexit

import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.nativecrash.NativeCrashFactory

internal class AppExitCollector(
    private val logger: Logger,
    private val appExitProvider: AppExitProvider,
    private val signalProcessor: SignalProcessor,
    private val sessionManager: SessionManager,
    private val packageName: String,
) {

    @RequiresApi(Build.VERSION_CODES.R)
    fun collect() {
        val appExitsMap: Map<Int, AppExit> = appExitProvider.get() ?: return
        appExitsMap.forEach { (pid, appExit) ->
            if (appExit.isANR()) {
                trackANR(pid, appExit)
            } else if (appExit.isNativeCrash()) {
                trackNativeCrash(pid, appExit)
            }
        }
        sessionManager.markSessionsAppExitTracked()
    }

    private fun trackNativeCrash(pid: Int, appExit: AppExit) {
        val tombstone = appExit.tombstone
        if (tombstone == null) {
            logger.log(LogLevel.Debug, "Discarding native crash for pid $pid, failed to read tombstone")
            return
        }
        val session = sessionManager.getSessionForAppExit(pid)
        if (session == null) {
            logger.log(LogLevel.Debug, "Discarding native crash for pid $pid, no matching session found")
            return
        }
        val data = NativeCrashFactory.create(tombstone, appExit.isForeground(), packageName)
        signalProcessor.trackNativeCrash(
            data = data,
            timestamp = appExit.app_exit_time_ms,
            threadName = data.exceptions.first().thread_name ?: "main",
            sessionId = session.id,
            sessionStartTime = session.createdAt,
            appVersion = session.appVersion,
            appBuild = session.appBuild,
        )
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun trackANR(pid: Int, appExit: AppExit) {
        val session = sessionManager.getSessionForAppExit(pid)
        if (session == null) {
            logger.log(
                LogLevel.Debug,
                "Discarding ANR exit for pid $pid no matching session found",
            )
            return
        }

        val threadDump = appExit.trace
        if (threadDump.isNullOrEmpty()) {
            logger.log(
                LogLevel.Debug,
                "Discarding ANR exit for pid $pid, failed to read thread dump",
            )
            return
        }

        signalProcessor.trackAnr(
            data = ExceptionData(
                exceptions = emptyList(),
                threads = emptyList(),
                foreground = appExit.isForeground(),
                art_thread_dump = threadDump,
                subject = appExit.subject,
            ),
            timestamp = appExit.app_exit_time_ms,
            // ANR events are always reported via the main thread
            threadName = "main",
            sessionId = session.id,
            sessionStartTime = session.createdAt,
            appVersion = session.appVersion,
            appBuild = session.appBuild,
        )
    }
}
