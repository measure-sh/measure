package sh.measure.android.storage

import sh.measure.android.SessionManager
import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.util.concurrent.RejectedExecutionException

internal interface DataCleanupService {
    fun clearStaleData()
}

/**
 * Cleans up stale data from the database and file storage.
 *
 * This service deletes all events, attachments, and sessions that
 * are not marked for reporting. It also deletes events for the oldest session if
 * the total number of events in database exceeds the maximum allowed.
 */
internal class DataCleanupServiceImpl(
    private val logger: Logger,
    private val fileStorage: FileStorage,
    private val database: Database,
    private val ioExecutor: MeasureExecutorService,
    private val sessionManager: SessionManager,
    private val configProvider: ConfigProvider,
) : DataCleanupService {
    private companion object {
        // The maximum number of sessions to query for deletion.
        // Keeping this to 1 as deleting too many sessions and events at once can lock
        // the db for other operations for too long. Each session can potentially
        // contain thousands of events, spans and attachments.
        const val MAX_SESSIONS_TO_QUERY = 1
    }

    override fun clearStaleData() {
        try {
            ioExecutor.submit {
                deleteSessionsNotMarkedForReporting()
                trimEventsAndSpans()
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Failed to submit data cleanup task to executor", e)
        }
    }

    private fun trimEventsAndSpans() {
        val eventsCount = database.getEventsCount()
        val spansCount = database.getSpansCount()
        val totalSignals = eventsCount + spansCount
        if (totalSignals <= configProvider.maxSignalsInDatabase) {
            return
        }
        logger.log(
            LogLevel.Warning,
            "Total signals ($totalSignals) exceeds the limit, deleting the oldest session.",
        )
        deleteOldestSession()
    }

    private fun deleteOldestSession() {
        database.getOldestSession()?.let {
            deleteSessions(listOf(it))
        }
    }

    private fun deleteSessionsNotMarkedForReporting() {
        val currentSessionId = sessionManager.getSessionId()
        val sessionIds = database.getSessionIds(
            needReporting = false,
            filterSessionIds = listOf(currentSessionId),
            maxCount = MAX_SESSIONS_TO_QUERY,
        )
        deleteSessions(sessionIds)
    }

    private fun deleteSessions(sessionIds: List<String>) {
        if (sessionIds.isEmpty()) {
            return
        }
        val eventIds = database.getEventsForSessions(sessionIds)
        val attachmentIds = database.getAttachmentsForEvents(eventIds)
        fileStorage.deleteEventsIfExist(eventIds, attachmentIds)
        // deleting sessions from db will also delete events for the session as they ar
        // e cascaded deletes.
        val result = database.deleteSessions(sessionIds)
        if (result) {
            logger.log(LogLevel.Debug, "Deleted ${eventIds.size} events")
        } else {
            logger.log(LogLevel.Warning, "Failed to delete ${eventIds.size} events")
        }
    }
}
