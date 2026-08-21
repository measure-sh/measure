package sh.measure.android.appexit

import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal class AppExitCollector(
    private val logger: Logger,
    private val appExitProvider: AppExitProvider,
    private val signalProcessor: SignalProcessor,
    private val sessionManager: SessionManager,
) {

    @RequiresApi(Build.VERSION_CODES.R)
    fun collect() {
        trackANRFromAppExit()
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun trackANRFromAppExit() {
        val appExitsMap: Map<Int, AppExit> = appExitProvider.get() ?: return
        appExitsMap.forEach { (pid, appExit) ->
            if (appExit.isANR()) {
                trackANR(pid, appExit)
            }
        }
        sessionManager.markSessionsAppExitTracked()
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
            // Use the time when app exit report was written
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
