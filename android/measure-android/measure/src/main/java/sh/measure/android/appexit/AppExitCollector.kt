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
                "Discarding ANR exit for pid $pid, no untracked session matches it",
            )
            return
        }

        // An ANR without a thread dump has no stack to act on: it cannot be
        // grouped apart from other ANRs of its kind and renders as an empty
        // accordion, so it is dropped rather than reported.
        val threadDump = appExit.trace
        if (threadDump.isNullOrEmpty()) {
            logger.log(
                LogLevel.Debug,
                "Discarding ANR exit for pid $pid, its thread dump could not be read",
            )
            return
        }

        logger.log(
            LogLevel.Debug,
            "Tracking ANR for pid $pid from a ${threadDump.length} byte thread dump",
        )
        signalProcessor.trackAnr(
            data = ExceptionData(
                exceptions = emptyList(),
                threads = emptyList(),
                foreground = appExit.isForeground(),
                art_thread_dump = threadDump,
                subject = appExit.subject,
            ),
            // Current time is irrelevant here, the ANR happened in a process
            // that is already gone.
            timestamp = appExit.app_exit_time_ms,
            // The stall is always reported against the main thread, which is
            // what the session timeline and the stacktrace accordion are
            // labelled by.
            threadName = "main",
            sessionId = session.id,
            sessionStartTime = session.createdAt,
            appVersion = session.appVersion,
            appBuild = session.appBuild,
        )
    }
}
