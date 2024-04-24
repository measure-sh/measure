package sh.measure.android

import android.app.ApplicationExitInfo
import sh.measure.android.appexit.AppExitCollector
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.storage.Database
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.TimeProvider

internal interface SessionIdProvider {
    val sessionId: String
}

/**
 * Manages creation of sessions.
 *
 * A session is created once and then kept in memory. A new session is created when the app
 * releases it's memory, which typically happens when the system kills the app.
 *
 * Sessions are also persisted to database and tied to a process ID. This is useful for
 * querying things like [ApplicationExitInfo]. See [AppExitCollector] for more details.
 */
internal class SessionManager(
    private val idProvider: IdProvider,
    private val database: Database,
    private val executorService: MeasureExecutorService,
    private val pidProvider: PidProvider,
    private val timeProvider: TimeProvider,
) : SessionIdProvider {

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

    private fun clearOldSessions() {
        database.clearOldSessions(
            currentTime = timeProvider.currentTimeSinceEpochInMillis,
            maxSessionPersistenceTime = MAX_SESSION_PERSISTENCE_TIME
        )
    }

    private fun storeSessionId(sessionId: String): String {
        database.insertSession(
            sessionId,
            pidProvider.getPid(),
            timeProvider.currentTimeSinceEpochInMillis
        )
        return sessionId
    }
}
