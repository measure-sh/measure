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
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.Randomizer
import sh.measure.android.utils.RandomizerImpl
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
 * back to foreground after being in background for more than [ConfigProvider.sessionEndThresholdMs].
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
    private val randomizer: Randomizer = RandomizerImpl(),
) : SessionManager {
    private var currentSession: RecentSession? = null
    private var appBackgroundTime: Long = 0

    override fun init() {
        val recentSession = prefs.getRecentSession()
        if (recentSession != null) {
            if (shouldContinue(recentSession)) {
                updateCurrentSession(
                    recentSession.id,
                    recentSession.createdAt,
                    recentSession.crashed,
                )
                updateSession(recentSession.id, processInfo.getPid(), recentSession.createdAt)
                logger.log(LogLevel.Debug, "Continuing previous session ${recentSession.id}")
                return
            }
        }
        val newSessionId = idProvider.createId()
        val needsReporting = shouldMarkSessionForExport()
        val createdAt = timeProvider.currentTimeSinceEpochInMillis
        storeSession(newSessionId, needsReporting, createdAt)
        updateCurrentSession(newSessionId, createdAt, crashed = false)
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
        val createdAt = this.currentSession?.createdAt ?: return

        if (event.sessionId != currentSessionId) {
            // tracking event for an older session should not update the recent session.
            return
        }

        val crashed = event.isUnhandledException() || event.isAnr()
        updateRecentSession(currentSessionId, createdAt, crashed = crashed)
    }

    override fun onAppForeground() {
        if (appBackgroundTime == 0L) {
            // app hasn't gone to background yet, it's coming to foreground for the first time.
            return
        }
        if (appBackgroundTime > configProvider.sessionEndThresholdMs) {
            // re-initialize session
            init()
            // reset app background time
            appBackgroundTime = 0
        }
    }

    override fun onAppBackground() {
        appBackgroundTime = timeProvider.currentTimeSinceEpochInMillis
    }

    override fun clearAppExitSessionsBefore(timestamp: Long) {
        database.clearAppExitSessionsBefore(timestamp)
    }

    override fun markCrashedSession(sessionId: String) {
        database.markCrashedSession(sessionId)
    }

    private fun storeSession(sessionId: String, needsReporting: Boolean, createdAt: Long) {
        try {
            ioExecutor.submit {
                val success = database.insertSession(
                    SessionEntity(
                        sessionId,
                        processInfo.getPid(),
                        createdAt,
                        needsReporting = needsReporting,
                        supportsAppExit = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
                    ),
                )
                if (success) {
                    logger.log(LogLevel.Debug, "New session created: $sessionId")
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

    private fun updateSession(sessionId: String, pid: Int, createdAt: Long) {
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

        // Continue session if no event have been tracked yet.
        if (recentSession.hasTrackedEvent()) {
            val elapsedTime =
                timeProvider.currentTimeSinceEpochInMillis - recentSession.lastEventTime
            return elapsedTime <= configProvider.sessionEndThresholdMs
        }
        return true
    }

    override fun markCrashedSessions(sessionIds: List<String>) {
        database.markCrashedSessions(sessionIds)
    }

    private fun updateCurrentSession(id: String, createdAt: Long, crashed: Boolean) {
        currentSession = RecentSession(id, createdAt, 0, crashed = crashed)
    }

    private fun updateRecentSession(
        currentSessionId: String,
        createdAt: Long,
        crashed: Boolean,
    ): RecentSession {
        val recentSession = RecentSession(
            id = currentSessionId,
            lastEventTime = timeProvider.currentTimeSinceEpochInMillis,
            createdAt = createdAt,
            crashed = crashed,
        )
        prefs.setRecentSession(recentSession)
        return recentSession
    }

    private fun shouldMarkSessionForExport(): Boolean {
        if (configProvider.sessionSamplingRate == 0.0f) {
            return false
        }
        if (configProvider.sessionSamplingRate == 1.0f) {
            return true
        }
        return randomizer.random() < configProvider.sessionSamplingRate
    }

    private fun <T> Event<T>.isUnhandledException(): Boolean {
        return type == EventType.EXCEPTION && data is ExceptionData && !data.handled
    }

    private fun <T> Event<T>.isAnr(): Boolean {
        return type == EventType.ANR
    }
}
