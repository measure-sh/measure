package sh.measure.android.appexit

import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData

internal class AppExitCollector(
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
        appExitsMap.forEach {
            val pid = it.key
            val appExit = it.value
            val session = sessionManager.getSessionForAppExit(pid)
            val threadDump = appExit.trace
            // An ANR without a thread dump has no stack to act on: it cannot be
            // grouped apart from other ANRs of its kind and renders as an empty
            // accordion, so it is dropped rather than reported.
            if (session != null && appExit.isANR() && !threadDump.isNullOrEmpty()) {
                signalProcessor.trackAnr(
                    data = ExceptionData(
                        exceptions = emptyList(),
                        threads = emptyList(),
                        foreground = appExit.isForeground(),
                        art_thread_dump = threadDump,
                        subject = appExit.subject,
                    ),
                    // Current time is irrelevant here, the ANR happened in a
                    // process that is already gone.
                    timestamp = appExit.app_exit_time_ms,
                    // The stall is always reported against the main thread,
                    // which is what the session timeline and the stacktrace
                    // accordion are labelled by.
                    threadName = "main",
                    sessionId = session.id,
                    sessionStartTime = session.createdAt,
                    appVersion = session.appVersion,
                    appBuild = session.appBuild,
                )
            }
        }
        sessionManager.markSessionsAppExitTracked()
    }
}
