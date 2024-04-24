package sh.measure.android

import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.storage.Database
import sh.measure.android.appexit.AppExitCollector
import android.app.ApplicationExitInfo
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.PidProvider

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
) : SessionIdProvider {
    override val sessionId: String by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
        createAndPersistSessionId()
    }

    private fun createAndPersistSessionId(): String {
        val id = idProvider.createId()
        executorService.submit {
            database.insertSession(id, pidProvider.getPid())
        }
        return id
    }
}
