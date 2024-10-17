package sh.measure.android

import sh.measure.android.config.ConfigProvider
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

internal interface SessionManager {
    /**
     * The session ID currently active, can be null if a session has not been created yet.
     */
    val currentSessionId: String?

    /**
     * Returns a session ID, creates a new one if none exists.
     */
    fun getOrCreateSession(): String

    /**
     * Returns a list of all sessions along with the process ID attached to the session.
     *
     * @return A map of process ID to list of session IDs that were created by that process.
     */
    fun getSessionsWithUntrackedAppExit(): Map<Int, List<String>>

    /**
     * Updates the sessions table to mark the app exit event as tracked.
     *
     * @param pid The process ID for which the app exit event was tracked.
     */
    fun updateAppExitTracked(pid: Int)

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
    fun onEventTracked()
}

/**
 * Manages creation of sessions.
 *
 * A new session is created when [getOrCreateSession] is first called. A session ends when the app comes
 * back to foreground after being in background for more than [ConfigProvider.sessionEndThresholdMs].
 */
internal class SessionManagerImpl(
    private val logger: Logger,
    private val idProvider: IdProvider,
    private val database: Database,
    private val prefs: PrefsStorage,
    private val processInfo: ProcessInfoProvider,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
    private val randomizer: Randomizer = RandomizerImpl(),
) : SessionManager {
    override var currentSessionId: String? = null
    private var recentSession: RecentSession? = null

    override fun onEventTracked() {
        // Ignore if current session isn't set yet. This can
        // happen if session ID has not been assigned but an event
        // was tracked using a previous session id.
        val currentSessionId = this.currentSessionId ?: return
        val recentSession = RecentSession(
            id = currentSessionId,
            lastEventTime = timeProvider.currentTimeSinceEpochInMillis,
        )
        prefs.setRecentSession(recentSession)
        this.recentSession = recentSession
    }

    /**
     * Returns the [currentSessionId] if available. Otherwise, if last event happened within
     * a configured threshold time, the previous event's session is continued, otherwise a
     * new session is created.
     *
     * This function may make a database query so it must be called from a background thread.
     */
    override fun getOrCreateSession(): String {
        val currentSessionId = this.currentSessionId
        if (currentSessionId != null) {
            return currentSessionId
        }
        val lastEvent = recentSession ?: loadMostRecentEvent()
        if (lastEvent != null) {
            val elapsedTime = timeProvider.currentTimeSinceEpochInMillis - lastEvent.lastEventTime
            if (elapsedTime <= configProvider.sessionEndThresholdMs) {
                logger.log(LogLevel.Debug, "Continuing previous session ${lastEvent.id}")
                updateCurrentSession(lastEvent.id)
                return lastEvent.id
            }
        }
        val newSessionId = createNewSession()
        updateCurrentSession(newSessionId)
        return newSessionId
    }

    private fun updateCurrentSession(sessionId: String) {
        currentSessionId = sessionId
    }

    private fun loadMostRecentEvent(): RecentSession? {
        return prefs.getRecentSession()
    }

    private fun createNewSession(): String {
        val newSessionId = idProvider.createId()
        val needsReporting = shouldMarkSessionForExport()
        storeSession(newSessionId, needsReporting)
        logger.log(LogLevel.Debug, "New session created: $newSessionId")
        return newSessionId
    }

    override fun getSessionsWithUntrackedAppExit(): Map<Int, List<String>> {
        return database.getSessionsWithUntrackedAppExit()
    }

    override fun updateAppExitTracked(pid: Int) {
        database.updateAppExitTracked(pid)
    }

    override fun markCrashedSession(sessionId: String) {
        database.markCrashedSession(sessionId)
    }

    override fun markCrashedSessions(sessionIds: List<String>) {
        database.markCrashedSessions(sessionIds)
    }

    private fun storeSession(sessionId: String, needsReporting: Boolean): Boolean {
        return database.insertSession(
            SessionEntity(
                sessionId,
                processInfo.getPid(),
                timeProvider.currentTimeSinceEpochInMillis,
                needsReporting = needsReporting,
            ),
        )
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
}
