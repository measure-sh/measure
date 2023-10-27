package sh.measure.android.session

import sh.measure.android.events.Event
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.network.Transport
import sh.measure.android.storage.Storage
import sh.measure.android.utils.runAllowDiskWrites
import java.util.concurrent.RejectedExecutionException

/**
 * A facade for creating, updating and syncing [Session]s and [Event]s.
 */
internal interface SessionController {
    /**
     * Creates a new [Session].
     */
    fun createSession()

    /**
     * Sends all unsynced [Session]s, which ended in a crash, to the server.
     */
    fun syncAllSessions()

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
) : SessionController {
    private val session: Session
        get() = sessionProvider.session

    override fun createSession() {
        sessionProvider.createSession()
        runAllowDiskWrites {
            storage.storeSession(session)
        }
    }

    override fun syncAllSessions() {
        try {
            executorService.submit {
                storage.getAllSessions().filter { it.id != session.id }.forEach { session ->
                    sessionReportGenerator.getSessionReport(session).let { report ->
                        logger.log(LogLevel.Debug, "exception: ${session.id}")
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
