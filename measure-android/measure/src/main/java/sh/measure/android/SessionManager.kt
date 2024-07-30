package sh.measure.android

import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.Randomizer
import sh.measure.android.utils.RandomizerImpl
import sh.measure.android.utils.TimeProvider

internal interface SessionManager {
    /**
     * Returns the current session Id.
     */
    fun getSessionId(): String

    /**
     * Returns a list of all sessions along with the process ID attached to the session.
     *
     * @return A map of process ID to list of session IDs that were created by that process.
     */
    fun getSessionsWithUntrackedAppExit(): Map<Int, List<String>>

    /**
     * Called when the app is backgrounded.
     */
    fun onAppBackground()

    /**
     * Called when the app is foregrounded.
     */
    fun onAppForeground()

    /**
     * Clears old sessions from the database.
     */
    fun clearOldSessions()

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
     * @param sessionId The session ID that crashed.
     */
    fun markCrashedSessions(sessionIds: List<String>)
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
    private val ioExecutor: MeasureExecutorService,
    private val processInfo: ProcessInfoProvider,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
    private val randomizer: Randomizer = RandomizerImpl(),
) : SessionManager {
    private var appBackgroundedUptimeMs = 0L

    internal var currentSessionId: String? = null

    override fun getSessionId(): String {
        if (currentSessionId == null) {
            createNewSession()
        }
        return currentSessionId!!
    }

    override fun getSessionsWithUntrackedAppExit(): Map<Int, List<String>> {
        return database.getSessionsWithUntrackedAppExit()
    }

    override fun onAppBackground() {
        appBackgroundedUptimeMs = timeProvider.uptimeInMillis
    }

    override fun onAppForeground() {
        if (appBackgroundedUptimeMs == 0L || currentSessionId == null) {
            // if the app was never in background or a session was never created, return early.
            return
        }
        endSessionIfNeeded()
    }

    // Ending a session currently means immediately creating a new session. This can be used to
    // clear up resources associated with a session in future or take any other action.
    private fun endSessionIfNeeded() {
        val durationInBackground = timeProvider.uptimeInMillis - appBackgroundedUptimeMs
        if (durationInBackground >= configProvider.sessionEndThresholdMs) {
            logger.log(
                LogLevel.Debug,
                "Ending session as app was relaunched after being in background for $durationInBackground ms",
            )
            createNewSession()
        }
    }

    override fun clearOldSessions() {
        ioExecutor.submit {
            val currentTime = timeProvider.currentTimeSinceEpochInMillis
            val sessionExpirationTime = currentTime - configProvider.sessionsTtlMs
            val unsampledSessionExpirationTime = currentTime - configProvider.unsampledSessionTtlMs
            database.clearOldSessions(sessionExpirationTime, unsampledSessionExpirationTime)
        }
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

    private fun createNewSession() {
        val id = idProvider.createId()
        currentSessionId = id
        ioExecutor.submit {
            val needsReporting = shouldMarkSessionForExport()
            storeSession(id, needsReporting)
            logger.log(
                LogLevel.Debug,
                "New session created with ID: $currentSessionId with needsReporting=$needsReporting"
            )
        }
    }

    private fun storeSession(sessionId: String, needsReporting: Boolean) {
        database.insertSession(
            sessionId,
            processInfo.getPid(),
            timeProvider.currentTimeSinceEpochInMillis,
            needsReporting = needsReporting,
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
