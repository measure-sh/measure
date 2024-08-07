package sh.measure.android

import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
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

    override fun init() {
        createNewSession()
    }

    override fun getSessionId(): String {
        val sessionId = currentSessionId
        requireNotNull(sessionId) {
            "Session ID is null. Ensure that init() is called before calling getSessionId()"
        }
        return sessionId
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
        if (shouldEndSession()) {
            createNewSession()
        }
    }

    private fun shouldEndSession(): Boolean {
        val durationInBackground = timeProvider.uptimeInMillis - appBackgroundedUptimeMs
        if (durationInBackground >= configProvider.sessionEndThresholdMs) {
            logger.log(
                LogLevel.Debug,
                "Ending session as app was relaunched after being in background for $durationInBackground ms",
            )
            return true
        }

        return false
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
        try {
            ioExecutor.submit {
                val needsReporting = shouldMarkSessionForExport()
                val success = storeSession(id, needsReporting)
                if (success) {
                    logger.log(
                        LogLevel.Debug,
                        "New session created with ID: $currentSessionId with needsReporting=$needsReporting",
                    )
                } else {
                    logger.log(
                        LogLevel.Error,
                        "Unable to store session with ID: $currentSessionId",
                    )
                }
            }
        } catch (e: RejectedExecutionException) {
            logger.log(
                LogLevel.Error,
                "Unable to store session with ID: $currentSessionId, all events will be discarded",
                e
            )
        }
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
