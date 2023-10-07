package sh.measure.android.session

import android.os.Handler
import sh.measure.android.events.Event
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.network.Transport
import sh.measure.android.storage.Storage
import sh.measure.android.storage.UnsyncedSession
import sh.measure.android.utils.iso8601Timestamp
import sh.measure.android.utils.runAllowDiskWrites
import java.util.concurrent.RejectedExecutionException

/**
 * A facade for creating, updating and syncing [Session]s and [Event]s.
 */
internal interface SessionController {
    /**
     * The current [Session].
     */
    val session: Session

    /**
     * Creates a new [Session].
     *
     * @param onSuccess Callback to be invoked when the session is created.
     */
    fun createSession(
        onSuccess: (sessionId: String) -> Unit,
        onError: () -> Unit
    )

    /**
     * Deletes all [Session]s which did not end with a crash.
     * This helps in removing stable sessions which we do not need to send to the server.
     */
    fun deleteSyncedSessions()

    /**
     * Sends all unsynced [Session]s, which ended in a crash, to the server.
     */
    fun syncSessions()

    /**
     * Sends the active [Session] to the server.
     */
    fun syncActiveSession()

    /**
     * Stores an [Event] in persistent storage.
     */
    fun storeEvent(event: Event)

    /**
     * Stores an [Event] in persistent storage synchronously.
     */
    fun storeEventSync(event: Event)
}

internal class SessionControllerImpl(
    private val logger: Logger,
    private val sessionProvider: SessionProvider,
    private val storage: Storage,
    private val transport: Transport,
    private val executorService: MeasureExecutorService,
    private val sessionReportGenerator: SessionReportGenerator,
    private val mainHandler: Handler
) : SessionController {
    override val session: Session
        get() = sessionProvider.session

    override fun createSession(
        onSuccess: (sessionId: String) -> Unit,
        onError: () -> Unit
    ) {
        try {
            executorService.submit {
                sessionProvider.createSession()
                storage.createSession(session)
                storage.createResource(session.resource, session.id)
                mainHandler.post {
                    onSuccess(session.id)
                }
            }
        } catch (e: RejectedExecutionException) {
            onError()
            logger.log(LogLevel.Error, "Failed to create session, executor service is closed", e)
        } catch (e: Exception) {
            onError()
            logger.log(LogLevel.Error, "Failed to create session", e)
        }
    }

    override fun deleteSyncedSessions() {
        try {
            executorService.submit {
                storage.deleteSyncedSessions()
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Failed to delete unsynced sessions", e)
        } catch (e: NullPointerException) {
            logger.log(LogLevel.Error, "Failed to delete unsynced sessions", e)
        }
    }

    override fun syncSessions() {
        try {
            executorService.submit {
                storage.getUnsyncedSessions().filter { it.id != session.id }.forEach { session ->
                    sessionReportGenerator.getSessionReport(session).let { report ->
                        logger.log(LogLevel.Debug, "Sending unsynced session report: ${session.id}")
                        transport.sendSessionReport(report, object : Transport.Callback {
                            override fun onSuccess() {
                                storage.deleteSession(session.id)
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

    override fun syncActiveSession() {
        // The write operation is performed synchronously to ensure it is completed before the
        // process terminates in the event of a crash.
        runAllowDiskWrites {
            try {
                val session =
                    UnsyncedSession(session.id, session.startTime.iso8601Timestamp(), session.pid)
                sessionReportGenerator.getSessionReport(session).let {
                    transport.sendSessionReport(it, object : Transport.Callback {
                        override fun onSuccess() {
                            storage.deleteSession(sessionId = session.id)
                        }
                    })
                }
            } catch (e: Exception) {
                logger.log(LogLevel.Debug, "Failed to sync active session on crash", e)
            }
        }
    }

    override fun storeEvent(event: Event) {
        try {
            executorService.submit {
                storeEventInternal(event)
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to store event", e)
        } catch (e: NullPointerException) {
            logger.log(LogLevel.Debug, "Failed to store event", e)
        }
    }

    override fun storeEventSync(event: Event) {
        storeEventInternal(event)
    }

    private fun storeEventInternal(event: Event) {
        storage.storeEvent(event, sessionProvider.session.id)
    }
}
