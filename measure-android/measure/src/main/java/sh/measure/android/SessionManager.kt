package sh.measure.android

import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.ProcessInfoProvider
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
    fun getSessionsForPids(): Map<Int, List<String>>

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
}

/**
 * Manages creation of sessions.
 *
 * A new session is created when [getSessionId] is first called. A session ends when the app comes
 * back to foreground after being in background for more than [BACKGROUND_DURATION_TO_END_SESSION_MS].
 */
internal class SessionManagerImpl(
    private val logger: Logger,
    private val idProvider: IdProvider,
    private val database: Database,
    private val executorService: MeasureExecutorService,
    private val processInfo: ProcessInfoProvider,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
) : SessionManager {
    private var appBackgroundedUptimeMs = 0L

    @Volatile
    internal var currentSessionId: String? = null

    override fun getSessionId(): String {
        if (currentSessionId == null) {
            createNewSession()
        }
        return currentSessionId!!
    }

    override fun getSessionsForPids(): Map<Int, List<String>> {
        return database.getSessionsForPids()
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
        if (durationInBackground >= configProvider.defaultSessionEndThresholdMs) {
            logger.log(
                LogLevel.Debug,
                "Ending session as app was relaunched after being in background for $durationInBackground ms",
            )
            createNewSession()
        }
    }

    override fun clearOldSessions() {
        executorService.submit {
            val clearUpToTimeSinceEpoch =
                timeProvider.currentTimeSinceEpochInMillis - configProvider.defaultSessionsTableTtlMs
            database.clearOldSessions(clearUpToTimeSinceEpoch)
        }
    }

    private fun createNewSession() {
        val id = idProvider.createId()
        currentSessionId = id
        executorService.submit {
            storeSessionId(id)
        }
        logger.log(LogLevel.Debug, "New session created with ID: $currentSessionId")
    }

    private fun storeSessionId(sessionId: String) {
        database.insertSession(
            sessionId,
            processInfo.getPid(),
            timeProvider.currentTimeSinceEpochInMillis,
        )
    }
}
