package sh.measure.android.appexit

import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.storage.Database

internal class AppExitCollector(
    private val appExitProvider: AppExitProvider,
    private val database: Database,
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
        val trackedSessions = mutableListOf<Session>()
        appExitsMap.forEach {
            val pid = it.key
            val appExit = it.value
            val session = getSessionForAppExit(pid)
            // Limiting tracking of app exit events to just
            // ANRs for now.
            if (session != null && appExit.isANR()) {
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
                    isSampled = true,
                )
                trackedSessions.add(session)
            }
        }
        database.clearAppExitRecords(excludeSessionId = sessionManager.getSessionId())
    }

    private fun getSessionForAppExit(pid: Int): Session? = database.getSessionForAppExit(pid)

    internal data class Session(
        val id: String,
        val pid: Int,
        val createdAt: Long,
        val appVersion: String?,
        val appBuild: String?,
    )
}
