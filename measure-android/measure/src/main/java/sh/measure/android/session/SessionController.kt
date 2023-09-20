package sh.measure.android.session

import android.os.StrictMode
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.executors.BackgroundTaskRunner
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.network.Transport
import sh.measure.android.storage.Storage
import java.util.concurrent.RejectedExecutionException

/**
 * A facade that simplifies access to session provider, storage, transport and background task
 * runner.
 */
internal interface SessionController {
    /**
     * The current [Session].
     */
    val session: Session

    /**
     * Creates a new [Session].
     */
    fun createSession()

    /**
     * Deletes all [Session]s which did not end with a crash.
     * This helps in removing stable sessions which we do not need to send to the server.
     */
    fun deleteSessionsWithoutCrash()

    /**
     * Sends all unsynced [Session]s, which ended in a crash, to the server.
     */
    fun syncSessions()

    /**
     * Sends the active [Session] to the server on the event of a crash.
     */
    fun syncActiveSessionOnCrash(measureException: MeasureException)
}

internal class SessionControllerImpl(
    private val logger: Logger,
    private val sessionProvider: SessionProvider,
    private val storage: Storage,
    private val transport: Transport,
    private val backgroundTaskRunner: BackgroundTaskRunner
) : SessionController {
    override val session: Session
        get() = sessionProvider.session

    override fun createSession() {
        sessionProvider.createSession()
        try {
            backgroundTaskRunner.execute { storage.saveSession(session) }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Failed to insert session into database", e)
        }
    }

    override fun deleteSessionsWithoutCrash() {
        try {
            backgroundTaskRunner.execute {
                storage.deleteSessionsWithoutCrash(sessionProvider.session.id)
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to delete sessions without crash", e)
        } catch (e: NullPointerException) {
            logger.log(LogLevel.Debug, "Failed to delete sessions without crash", e)
        }
    }

    override fun syncSessions() {
        try {
            backgroundTaskRunner.execute {
                storage.getUnsyncedSessions().forEach { sessionId ->
                    logger.log(LogLevel.Debug, "Sending unsynced session report: $sessionId")
                    storage.getSessionReport(sessionId)?.let {
                        transport.sendSessionReport(it, object : Transport.Callback {
                            override fun onSuccess() {
                                storage.deleteSessionAndSignals(sessionId)
                            }
                        })
                    }
                }
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to sync sessions", e)
        } catch (e: NullPointerException) {
            logger.log(LogLevel.Debug, "Failed to sync sessions", e)
        }
    }

    override fun syncActiveSessionOnCrash(measureException: MeasureException) {
        // The write operation is performed synchronously to ensure it is completed before the
        // process terminates in the event of a crash.
        val oldPolicy = StrictMode.getThreadPolicy()
        StrictMode.setThreadPolicy(StrictMode.allowThreadDiskWrites())
        try {
            val activeSessionId = session.id
            storage.saveUnhandledException(measureException.toSignal(activeSessionId))
            storage.getSessionReport(activeSessionId)?.let {
                transport.sendSessionReport(it, object : Transport.Callback {
                    override fun onSuccess() {
                        storage.deleteSessionAndSignals(activeSessionId)
                    }
                })
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Debug, "Failed to sync active session on crash", e)
        } finally {
            StrictMode.setThreadPolicy(oldPolicy)
        }
    }
}