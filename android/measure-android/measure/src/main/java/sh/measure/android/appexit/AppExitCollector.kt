package sh.measure.android.appexit

import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.nativecrash.NativeCrashFactory
import sh.measure.android.storage.SessionRecord

internal class AppExitCollector(
    private val logger: Logger,
    private val appExitProvider: AppExitProvider,
    private val signalProcessor: SignalProcessor,
    private val sessionManager: SessionManager,
    private val nativeCrashFactory: NativeCrashFactory,
) {

    @RequiresApi(Build.VERSION_CODES.R)
    fun collect() {
        val appExits: List<AppExit> = appExitProvider.get() ?: return
        appExits.forEach { appExit ->
            val session = sessionManager.getSessionForAppExit(appExit.pid)
            if (session == null) {
                logger.log(LogLevel.Debug, "Discarding app exit for pid ${appExit.pid}, no matching session found")
                return@forEach
            }
            when (appExit) {
                is AppExit.Anr -> trackAnr(appExit, session)
                is AppExit.NativeCrash -> trackNativeCrash(appExit, session)
            }
        }
        sessionManager.markSessionsAppExitTracked()
    }

    private fun trackNativeCrash(appExit: AppExit.NativeCrash, session: SessionRecord) {
        val data = nativeCrashFactory.create(appExit.tombstone, appExit.foreground, appExit.recoverable)
        signalProcessor.trackNativeCrash(
            data = data,
            timestamp = appExit.timestamp,
            threadName = data.exceptions.first().thread_name ?: "main",
            sessionId = session.id,
            sessionStartTime = session.createdAt,
            appVersion = session.appVersion,
            appBuild = session.appBuild,
        )
    }

    private fun trackAnr(appExit: AppExit.Anr, session: SessionRecord) {
        signalProcessor.trackAnr(
            data = ExceptionData(
                exceptions = emptyList(),
                threads = emptyList(),
                foreground = appExit.foreground,
                art_thread_dump = appExit.trace,
                subject = appExit.subject,
            ),
            timestamp = appExit.timestamp,
            // ANR events are always reported via the main thread
            threadName = "main",
            sessionId = session.id,
            sessionStartTime = session.createdAt,
            appVersion = session.appVersion,
            appBuild = session.appBuild,
        )
    }
}
