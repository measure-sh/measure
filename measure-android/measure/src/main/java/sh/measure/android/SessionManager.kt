package sh.measure.android

import android.app.ApplicationExitInfo
import sh.measure.android.SessionManagerImpl.Companion.MAX_SESSION_PERSISTENCE_TIME
import sh.measure.android.appexit.AppExitCollector
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.storage.Database
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider

internal interface SessionManager {
    /**
     * Returns the current session Id.
     */
    val sessionId: String

    /**
     * Returns a list of all sessions along with the process ID attached to the session.
     *
     * @return A list of pairs where the first element is the session ID and the second element is
     * the process ID.
     */
    fun getSessions(): List<Pair<String, Int>>

    /**
     * Deletes the session with given sessionId.
     *
     * @param sessionId The session ID to delete.
     */
    fun deleteSession(sessionId: String)
}

/**
 * Manages creation of sessions.
 *
 * A session is created once and then kept in memory until the system kills the app.
 *
 * Sessions are also persisted to database and tied to a process ID. This is useful for
 * querying things like [ApplicationExitInfo]. See [AppExitCollector] for more details.
 *
 * Sessions are currently only used for tracking app exits by providing a link between the
 * session and the process ID. Sessions are deleted from database once the app exit for the session
 * has been tracked or if the session is older than [MAX_SESSION_PERSISTENCE_TIME].
 */
internal class SessionManagerImpl(
    private val idProvider: IdProvider,
    private val database: Database,
    private val executorService: MeasureExecutorService,
    private val processInfo: ProcessInfoProvider,
    private val timeProvider: TimeProvider,
) : SessionManager {

    internal companion object {
        // 15 days
        const val MAX_SESSION_PERSISTENCE_TIME: Long = 1_296_000_000
    }

    override val sessionId: String by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
        val id = idProvider.createId()
        executorService.submit {
            storeSessionId(id)
            clearOldSessions()
        }
        return@lazy id
    }

    override fun getSessions(): List<Pair<String, Int>> {
        return database.getSessions()
    }

    override fun deleteSession(sessionId: String) {
        database.deleteSession(sessionId)
    }

    private fun clearOldSessions() {
        database.clearOldSessions(timeProvider.currentTimeSinceEpochInMillis - MAX_SESSION_PERSISTENCE_TIME)
    }

    private fun storeSessionId(sessionId: String): String {
        database.insertSession(
            sessionId,
            processInfo.getPid(),
            timeProvider.currentTimeSinceEpochInMillis,
        )
        return sessionId
    }
}
