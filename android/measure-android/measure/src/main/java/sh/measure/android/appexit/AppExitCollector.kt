package sh.measure.android.appexit

import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor

internal class AppExitCollector(
    private val appExit: AppExit,
    private val signalProcessor: SignalProcessor,
    private val sessionManager: SessionManager,
) {

    @RequiresApi(Build.VERSION_CODES.R)
    fun collect() {
        val exits: Map<Int, AppExitData> = appExit.get() ?: return
        exits.forEach { (pid, exit) ->
            val session = sessionManager.getSessionForAppExit(pid) ?: return@forEach
            signalProcessor.trackForSession(
                exit,
                // The exit belongs to the moment the system recorded it,
                // not to this launch.
                exit.app_exit_time_ms,
                EventType.APP_EXIT,
                sessionId = session.id,
                sessionStartTime = session.createdAt,
                appVersion = session.appVersion,
                appBuild = session.appBuild,
            )
        }
    }
}
