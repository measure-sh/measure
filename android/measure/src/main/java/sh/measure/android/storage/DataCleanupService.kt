package sh.measure.android.storage

import sh.measure.android.SessionManager
import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.tracing.InternalTrace

internal interface DataCleanupService {
    fun cleanup()
}

private const val DB_DELETION_BATCH_SIZE = 1000

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
    override fun cleanup() {
        val currentSessionId = sessionManager.getSessionId()
        ioExecutor.submit {
            InternalTrace.trace(
                { "msr-cleanup" },
                {
                    deleteEvents(currentSessionId)
                    deleteSpans(currentSessionId)
                    deleteBugReports(currentSessionId)
                    deleteEmptySessions(currentSessionId)
                    trimMemoryUsage(currentSessionId)
                },
            )
        }
    }

    private fun deleteBugReports(currentSessionId: String) {
        try {
            val bugReportsDir = fileStorage.getBugReportDir()
            if (!bugReportsDir.exists() || !bugReportsDir.isDirectory) {
                return
            }

            val files = bugReportsDir.listFiles()
            if (files != null) {
                logger.log(LogLevel.Debug, "Cleanup: Cleaning up ${files.size} bug reports")
                files.forEach { sessionDir ->
                    if (sessionDir.isDirectory && sessionDir.name != currentSessionId) {
                        sessionDir.deleteRecursively()
                    }
                }
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Debug, "Cleanup: Failed to clean up stale bug reports", e)
        }
    }

    private fun deleteEvents(currentSessionId: String) {
        InternalTrace.trace(
            { "msr-deleteEvents" },
            {
                while (true) {
                    val deletedEventIds = database.deleteEvents(
                        excludeSessionId = currentSessionId,
                        batchSize = DB_DELETION_BATCH_SIZE,
                    )

                    if (deletedEventIds.isNotEmpty()) {
                        logger.log(
                            LogLevel.Debug,
                            "Cleanup: Deleted ${deletedEventIds.size} events",
                        )
                    }

                    if (deletedEventIds.isEmpty()) break

                    fileStorage.deleteEventsIfExist(deletedEventIds)
                    fileStorage.deleteAttachmentsIfExist(deletedEventIds)

                    if (deletedEventIds.size < DB_DELETION_BATCH_SIZE) break
                }
            },
        )
    }

    private fun deleteSpans(currentSessionId: String) {
        InternalTrace.trace(
            { "msr-deleteSpans" },
            {
                while (true) {
                    val deletedSpanIds = database.deleteSpans(
                        excludeSessionId = currentSessionId,
                        batchSize = DB_DELETION_BATCH_SIZE,
                    )
                    if (deletedSpanIds.isNotEmpty()) {
                        logger.log(LogLevel.Debug, "Cleanup: Deleted ${deletedSpanIds.size} spans")
                    }
                    if (deletedSpanIds.isEmpty()) break
                    if (deletedSpanIds.size < DB_DELETION_BATCH_SIZE) break
                }
            },
        )
    }

    private fun deleteEmptySessions(currentSessionId: String) {
        InternalTrace.trace(
            { "msr-deleteEmptySessions" },
            {
                val sessionIds = database.getSessionIds(excludeSessionId = currentSessionId)
                val sessionsToDelete = mutableListOf<String>()
                for (sessionId in sessionIds) {
                    val events = database.getEventsCount(sessionId)
                    val spans = database.getSpansCount(sessionId)

                    if (events + spans == 0) {
                        sessionsToDelete.add(sessionId)
                    }
                }

                if (sessionsToDelete.isEmpty()) {
                    return@trace
                }

                logger.log(
                    LogLevel.Debug,
                    "Cleanup: Deleting ${sessionsToDelete.size} sessions with no events or spans",
                )
                sessionsToDelete.forEach {
                    database.deleteSession(it)
                }
            },
        )
    }

    private fun trimMemoryUsage(currentSessionId: String) {
        val eventsCount = database.getEventsCount()
        val spansCount = database.getSpansCount()
        val totalSignals = eventsCount + spansCount
        val estimatedSizeInMb = (totalSignals * configProvider.estimatedEventSizeInKb) / 1024

        if (estimatedSizeInMb <= configProvider.maxDiskUsageInMb.coerceIn(20, 1500)) {
            return
        }
        database.getOldestSession()?.let {
            if (it != currentSessionId) {
                val eventIds = database.getEventsForSession(it)
                fileStorage.deleteEventsIfExist(eventIds)
                val attachmentIds = database.getAttachmentsForEvents(eventIds)
                fileStorage.deleteAttachmentsIfExist(attachmentIds)

                // deleting sessions from db will also delete events, spans and attachments for the session
                // as they are cascaded deletes.
                database.deleteSession(it)
                logger.log(
                    LogLevel.Debug,
                    "DataCleanup: deleted session $it estimated storage: $estimatedSizeInMb, maxAllowed: ${configProvider.maxDiskUsageInMb}",
                )
            }
        }
    }
}
