package sh.measure.android

import android.os.Build
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.SessionEntity
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.PackageInfoProvider
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.Randomizer
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.RejectedExecutionException

internal interface SessionManager {
    /**
     * Creates a new session, to be used only when the SDK is initialized.
     */
    fun init()

    /**
     * Returns a session ID.
     */
    fun getSessionId(): String

    /**
     * Marks the session as crashed.
     *
     * @param sessionId The session ID that crashed.
     */
    fun markCrashedSession(sessionId: String)

    /**
     * Marks multiple sessions as crashed.
     *
     * @param sessionIds The session IDs that crashed.
     */
    fun markCrashedSessions(sessionIds: List<String>)

    /**
     * Marks that current session contains a bug report.
     */
    fun markSessionWithBugReport()

    /**
     * Call when an event is tracked.
     */
    fun <T> onEventTracked(event: Event<T>)

    /**
     * Call when app comes to foreground
     */
    fun onAppForeground()

    /**
     * Call when app goes to background
     */
    fun onAppBackground()

    /**
     * Clears sessions for tracking app exit which happened before the given [timestamp].
     */
    fun clearAppExitSessionsBefore(timestamp: Long)
}

/**
 * Manages creation of sessions.
 *
 * A new session is created when [getSessionId] is first called. A session ends when the app comes
 * back to foreground after being in background for more than [ConfigProvider.sessionEndLastEventThresholdMs].
 */
internal class SessionManagerImpl(
    private val logger: Logger,
    private val idProvider: IdProvider,
    private val database: Database,
    private val prefs: PrefsStorage,
    private val ioExecutor: MeasureExecutorService,
    private val processInfo: ProcessInfoProvider,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
    private val packageInfoProvider: PackageInfoProvider,
    private val randomizer: Randomizer,
) : SessionManager {
    private var currentSession: RecentSession? = null
    private var appBackgroundTime: Long = 0

    override fun init() {
        val recentSession = prefs.getRecentSession()
        currentSession = when {
            recentSession != null && shouldContinue(recentSession) -> {
                updateSessionPid(recentSession.id, processInfo.getPid(), recentSession.createdAt)
                logger.log(LogLevel.Debug, "Continuing previous session ${recentSession.id}")
                recentSession
            }

            else -> createNewSession()
        }
    }

    override fun getSessionId(): String {
        val sessionId = this.currentSession?.id
        requireNotNull(sessionId) {
            "Session manager must be initialized before accessing current session id"
        }
        return sessionId
    }

    override fun <T> onEventTracked(event: Event<T>) {
        val currentSessionId = this.currentSession?.id ?: return

        if (event.sessionId != currentSessionId) {
            // tracking event for an older session should not update the recent session.
            return
        }

        prefs.setRecentSessionEventTime(timeProvider.now())
        val crashed = event.isUnhandledException() || event.isAnr()
        if (crashed) {
            prefs.setRecentSessionCrashed()
        }
    }

    override fun onAppForeground() {
        if (appBackgroundTime == 0L) {
            // app hasn't gone to background yet, it's coming to foreground for the first time.
            return
        }
        appBackgroundTime = 0
        // re-initialize session if needed
        init()
    }

    override fun onAppBackground() {
        appBackgroundTime = timeProvider.elapsedRealtime
    }

    override fun clearAppExitSessionsBefore(timestamp: Long) {
        database.clearAppExitSessionsBefore(timestamp)
    }

    override fun markCrashedSession(sessionId: String) {
        database.markCrashedSession(sessionId)
    }

    override fun markSessionWithBugReport() {
        database.markSessionWithBugReport(sessionId = getSessionId())
    }

    private fun createNewSession(): RecentSession {
        val newSessionId = idProvider.uuid()
        val needsReporting = shouldMarkSessionForExport()
        val createdAt = timeProvider.now()
        val session = RecentSession(
            newSessionId,
            createdAt,
            versionCode = packageInfoProvider.getVersionCode(),
        )
        storeSession(session, needsReporting)
        return session
    }

    private fun storeSession(session: RecentSession, needsReporting: Boolean) {
        try {
            ioExecutor.submit {
                val success = database.insertSession(
                    SessionEntity(
                        session.id,
                        processInfo.getPid(),
                        session.createdAt,
                        needsReporting = needsReporting,
                        supportsAppExit = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
                        appVersion = packageInfoProvider.appVersion,
                        appBuild = packageInfoProvider.getVersionCode(),
                    ),
                )
                if (success) {
                    prefs.setRecentSession(session)
                    logger.log(LogLevel.Debug, "New session created: $session.sessionId")
                } else {
                    logger.log(
                        LogLevel.Error,
                        "Unable to store session, all events will be discarded",
                    )
                }
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Unable to store session, all events will be discarded", e)
        }
    }

    private fun updateSessionPid(sessionId: String, pid: Int, createdAt: Long) {
        try {
            ioExecutor.submit {
                database.updateSessionPid(
                    sessionId,
                    pid,
                    createdAt,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
                )
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Unable to update session", e)
        }
    }

    private fun shouldContinue(recentSession: RecentSession): Boolean {
        if (recentSession.crashed) {
            return false
        }

        val sessionDuration = timeProvider.now() - recentSession.createdAt
        if (sessionDuration < 0) {
            // Session duration can be negative due to clock skewness. In such a case create a new
            // session.
            return false
        }
        if (sessionDuration >= configProvider.maxSessionDurationMs) {
            return false
        }

        if (packageInfoProvider.getVersionCode() != recentSession.versionCode) {
            // The app version has changed since last session, create a new session.
            return false
        }

        if (recentSession.hasTrackedEvent()) {
            val elapsedTime = timeProvider.now() - recentSession.lastEventTime

            if (elapsedTime < 0) {
                // Elapsed time can be negative due to clock skewness. In such a case create a new
                // session.
                return false
            }

            return elapsedTime <= configProvider.sessionEndLastEventThresholdMs
        }
        return true
    }

    override fun markCrashedSessions(sessionIds: List<String>) {
        database.markCrashedSessions(sessionIds)
    }

    private fun shouldMarkSessionForExport(): Boolean {
        if (configProvider.samplingRateForErrorFreeSessions == 0.0f) {
            return false
        }
        if (configProvider.samplingRateForErrorFreeSessions == 1.0f) {
            return true
        }
        return randomizer.random() < configProvider.samplingRateForErrorFreeSessions
    }

    private fun <T> Event<T>.isUnhandledException(): Boolean {
        return type == EventType.EXCEPTION && data is ExceptionData && !data.handled
    }

    private fun <T> Event<T>.isAnr(): Boolean {
        return type == EventType.ANR
    }
}
