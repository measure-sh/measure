package sh.measure.android.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteConstraintException
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
import sh.measure.android.appexit.AppExitCollector
import sh.measure.android.exporter.AttachmentPacket
import sh.measure.android.exporter.Batch
import sh.measure.android.exporter.EventPacket
import sh.measure.android.exporter.SpanPacket
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.iso8601Timestamp
import java.io.Closeable

internal interface Database : Closeable {
    /**
     * Inserts an event into the database.
     *
     * @param event The event entity to insert.
     * @return `true` if the event was successfully inserted, `false` otherwise.
     */
    fun insertEvent(event: EventEntity): Boolean

    /**
     * Returns a list of maximum [eventCount] event IDs that have not yet been batched. By default
     * events are returned in ascending order of timestamp, unless specified otherwise.
     *
     * @param eventCount The number of events to return.
     * @param ascending If `true`, the events are returned in ascending order of timestamp. Else,
     * in descending order.
     * @param sessionId The session ID for which the events should be returned, if any.
     * @param eventTypeExportAllowList The list of event types that should be included in the result
     * regardless of session ID or whether the session is marked as "needs reporting" or not.
     *
     * @return a map of event Id to the size of attachments in the event in bytes.
     */
    fun getUnBatchedEventsWithAttachmentSize(
        eventCount: Int,
        ascending: Boolean = true,
        sessionId: String? = null,
        eventTypeExportAllowList: List<String> = emptyList(),
    ): LinkedHashMap<String, Long>

    fun getUnBatchedSpans(
        spanCount: Int,
        ascending: Boolean = true,
    ): List<String>

    /**
     * Inserts a batch.
     *
     * @param batchEntity The batch entity to insert.
     * @return `true` if the batch was successfully inserted, `false` otherwise.
     */
    fun insertBatch(batchEntity: BatchEntity): Boolean

    /**
     * Returns a list of event packets for the given event IDs.
     *
     * @param eventIds The list of event IDs to get event packets for.
     */
    fun getEventPackets(eventIds: List<String>): List<EventPacket>

    /**
     * Returns a list of spans packets for the given span IDs.
     *
     * @param spanIds The list of span IDs to get the span packets for.
     */
    fun getSpanPackets(spanIds: List<String>): List<SpanPacket>

    /**
     * Returns a list of attachment packets for the given event IDs.
     *
     * @param eventIds The list of event IDs to fetch attachments for.
     */
    fun getAttachmentPackets(eventIds: List<String>): List<AttachmentPacket>

    /**
     * Returns a map of batch IDs to event IDs that have not been synced with the server in
     * ascending order of creation time.
     *
     * @param maxBatches The maximum number of batches to return.
     * @return a map of batch ID to list of event IDs.
     */
    fun getBatches(maxBatches: Int): List<Batch>

    /**
     * Inserts a session entity into the database.
     *
     * @param session the session entity to insert.
     */
    fun insertSession(session: SessionEntity): Boolean

    fun updateSessionPid(
        sessionId: String,
        pid: Int,
        createdAt: Long,
        supportsAppExit: Boolean,
    ): Boolean

    /**
     * Deletes the sessions with the given IDs.
     *
     * @param sessionIds The list of session IDs to delete.
     * @return `true` if the sessions were successfully deleted, `false` otherwise.
     */
    fun deleteSessions(sessionIds: List<String>): Boolean

    /**
     * Returns the event entity for the given event IDs.
     */
    fun getEvents(eventIds: List<String>): List<EventEntity>

    /**
     * Returns the event Ids for all the events that are part of the given sessions.
     *
     * @param sessions The list of session IDs to get events for.
     * @return a list of event IDs.
     */
    fun getEventsForSessions(sessions: List<String>): List<String>

    /**
     * Returns the attachment Ids for all given event Ids.
     */
    fun getAttachmentsForEvents(events: List<String>): List<String>

    /**
     * Marks a session as crashed in the sessions table.
     *
     * @param sessionId The session ID that crashed.
     */
    fun markCrashedSession(sessionId: String)

    /**
     * Marks multiple sessions as crashed in the sessions table.
     * @param sessionIds The list of session IDs that crashed.
     */
    fun markCrashedSessions(sessionIds: List<String>)

    /**
     * Returns the session IDs based on the needReporting flag.
     *
     * @param needReporting If `true`, returns the session IDs that need to be reported. Else,
     * returns the session IDs that don't need to be reported.
     * @param filterSessionIds The list of session IDs to filter.
     */
    fun getSessionIds(
        needReporting: Boolean,
        filterSessionIds: List<String>,
        maxCount: Int,
    ): List<String>

    /**
     * Returns the session ID for the oldest session in the database.
     */
    fun getOldestSession(): String?

    /**
     * Returns the number of events in the database.
     */
    fun getEventsCount(): Int

    /**
     * Returns a session for a given pid from app exit table.
     * If multiple sessions span across the same pid, the most recent session id is returned.
     */
    fun getSessionForAppExit(pid: Int): AppExitCollector.Session?

    /**
     * Clears app exit for sessions which happened before the given [timestamp].
     */
    fun clearAppExitSessionsBefore(timestamp: Long)

    /**
     * Inserts a span into span table.
     */
    fun insertSpan(spanEntity: SpanEntity): Boolean

    /**
     * Deletes events, spans from respective tables along with the batch.
     */
    fun deleteBatch(batchId: String, eventIds: List<String>, spanIds: List<String>)

    /**
     * Returns the count of spans stored in spans table.
     */
    fun getSpansCount(): Int

    /**
     * Inserts a batch of events and spans in a single transaction.
     */
    fun insertSignals(eventEntities: List<EventEntity>, spanEntities: List<SpanEntity>): Boolean

    /**
     * Updates session table to indicate the session with given [sessionId] has a bug report
     * tracked.
     */
    fun markSessionWithBugReport(sessionId: String)
}

/**
 * Database implementation using SQLite.
 */
internal class DatabaseImpl(
    context: Context,
    private val logger: Logger,
) : SQLiteOpenHelper(context, DbConstants.DATABASE_NAME, null, DbConstants.DATABASE_VERSION),
    Database {

    override fun onCreate(db: SQLiteDatabase) {
        try {
            db.execSQL(Sql.CREATE_SESSIONS_TABLE)
            db.execSQL(Sql.CREATE_EVENTS_TABLE)
            db.execSQL(Sql.CREATE_ATTACHMENTS_TABLE)
            db.execSQL(Sql.CREATE_BATCHES_TABLE)
            db.execSQL(Sql.CREATE_EVENTS_BATCH_TABLE)
            db.execSQL(Sql.CREATE_APP_EXIT_TABLE)
            db.execSQL(Sql.CREATE_SPANS_TABLE)
            db.execSQL(Sql.CREATE_SPANS_BATCH_TABLE)
            db.execSQL(Sql.CREATE_EVENTS_TIMESTAMP_INDEX)
            db.execSQL(Sql.CREATE_EVENTS_SESSION_ID_INDEX)
            db.execSQL(Sql.CREATE_EVENTS_BATCH_EVENT_ID_INDEX)
            db.execSQL(Sql.CREATE_SESSIONS_CREATED_AT_INDEX)
            db.execSQL(Sql.CREATE_SESSIONS_NEEDS_REPORTING_INDEX)
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to create database", e)
        }
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        DbMigrations.apply(logger, db, oldVersion, newVersion)
    }

    override fun onConfigure(db: SQLiteDatabase) {
        // Enable WAL mode: https://www.sqlite.org/wal.html
        setWriteAheadLoggingEnabled(true)
        db.setForeignKeyConstraintsEnabled(true)
    }

    override fun insertEvent(event: EventEntity): Boolean {
        writableDatabase.beginTransaction()
        try {
            val values = ContentValues().apply {
                put(EventTable.COL_ID, event.id)
                put(EventTable.COL_TYPE, event.type)
                put(EventTable.COL_TIMESTAMP, event.timestamp)
                put(EventTable.COL_SESSION_ID, event.sessionId)
                put(EventTable.COL_USER_TRIGGERED, event.userTriggered)
                if (event.filePath != null) {
                    put(EventTable.COL_DATA_FILE_PATH, event.filePath)
                } else if (event.serializedData != null) {
                    put(EventTable.COL_DATA_SERIALIZED, event.serializedData)
                }
                put(EventTable.COL_ATTRIBUTES, event.serializedAttributes)
                put(EventTable.COL_USER_DEFINED_ATTRIBUTES, event.serializedUserDefAttributes)
                put(EventTable.COL_ATTACHMENT_SIZE, event.attachmentsSize)
                put(EventTable.COL_ATTACHMENTS, event.serializedAttachments)
            }

            val result = writableDatabase.insert(EventTable.TABLE_NAME, null, values)
            if (result == -1L) {
                logger.log(LogLevel.Error, "Failed to insert event = ${event.type}")
                return false // Rollback the transaction if event insertion fails
            }

            event.attachmentEntities?.forEach { attachment ->
                val attachmentValues = ContentValues().apply {
                    put(AttachmentTable.COL_ID, attachment.id)
                    put(AttachmentTable.COL_EVENT_ID, event.id)
                    put(AttachmentTable.COL_TYPE, attachment.type)
                    put(AttachmentTable.COL_TIMESTAMP, event.timestamp)
                    put(AttachmentTable.COL_SESSION_ID, event.sessionId)
                    put(AttachmentTable.COL_FILE_PATH, attachment.path)
                    put(AttachmentTable.COL_NAME, attachment.name)
                }
                val attachmentResult =
                    writableDatabase.insert(AttachmentTable.TABLE_NAME, null, attachmentValues)
                if (attachmentResult == -1L) {
                    logger.log(
                        LogLevel.Error,
                        "Failed to insert attachment ${attachment.type} for event = ${event.type}",
                    )
                    return false // Rollback the transaction if attachment insertion fails
                }
            }
            writableDatabase.setTransactionSuccessful()
            return true
        } catch (e: SQLiteConstraintException) {
            // We expect this to happen if for any reason the session could not be inserted to
            // the database before an event was triggered.
            // This can happen for exceptions/ANRs as they are written to the db on main thread,
            // while session insertion happens in background.
            logger.log(
                LogLevel.Error,
                "Failed to insert event ${event.type} for session ${event.sessionId}",
                e,
            )
            return false
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun getUnBatchedEventsWithAttachmentSize(
        eventCount: Int,
        ascending: Boolean,
        sessionId: String?,
        eventTypeExportAllowList: List<String>,
    ): LinkedHashMap<String, Long> {
        val query =
            Sql.getEventsBatchQuery(eventCount, ascending, sessionId, eventTypeExportAllowList)
        val cursor = readableDatabase.rawQuery(query, null)
        val eventIdAttachmentSizeMap = LinkedHashMap<String, Long>()

        cursor.use {
            while (it.moveToNext()) {
                val eventIdIndex = cursor.getColumnIndex(EventTable.COL_ID)
                val attachmentsSizeIndex = cursor.getColumnIndex(EventTable.COL_ATTACHMENT_SIZE)
                val eventId = cursor.getString(eventIdIndex)
                val attachmentSize = cursor.getLong(attachmentsSizeIndex)
                eventIdAttachmentSizeMap[eventId] = attachmentSize
            }
        }

        return eventIdAttachmentSizeMap
    }

    override fun getUnBatchedSpans(
        spanCount: Int,
        ascending: Boolean,
    ): List<String> {
        val query = Sql.getSpansBatchQuery(spanCount, ascending)
        val cursor = readableDatabase.rawQuery(query, null)
        val spanIds = mutableListOf<String>()

        cursor.use {
            while (it.moveToNext()) {
                val spanIdIndex = cursor.getColumnIndex(SpansTable.COL_SPAN_ID)
                val spanId = cursor.getString(spanIdIndex)
                spanIds.add(spanId)
            }
        }

        return spanIds
    }

    override fun insertBatch(batchEntity: BatchEntity): Boolean {
        writableDatabase.beginTransaction()
        try {
            val batches = ContentValues().apply {
                put(BatchesTable.COL_BATCH_ID, batchEntity.batchId)
                put(BatchesTable.COL_CREATED_AT, batchEntity.createdAt)
            }

            val batchesInsertResult = writableDatabase.insert(
                BatchesTable.TABLE_NAME,
                null,
                batches,
            )
            if (batchesInsertResult == -1L) {
                logger.log(LogLevel.Error, "Failed to insert batch = ${batchEntity.batchId}")
                return false
            }
            batchEntity.spanIds.forEach { spanId ->
                val spanBatches = ContentValues().apply {
                    put(SpansBatchTable.COL_SPAN_ID, spanId)
                    put(SpansBatchTable.COL_BATCH_ID, batchEntity.batchId)
                    put(SpansBatchTable.COL_CREATED_AT, batchEntity.createdAt)
                }
                val result = writableDatabase.insert(SpansBatchTable.TABLE_NAME, null, spanBatches)
                if (result == -1L) {
                    logger.log(LogLevel.Error, "Failed to insert batched span = $spanId")
                    return false
                }
            }
            batchEntity.eventIds.forEach { eventId ->
                val eventBatches = ContentValues().apply {
                    put(EventsBatchTable.COL_EVENT_ID, eventId)
                    put(EventsBatchTable.COL_BATCH_ID, batchEntity.batchId)
                    put(EventsBatchTable.COL_CREATED_AT, batchEntity.createdAt)
                }
                val result =
                    writableDatabase.insert(EventsBatchTable.TABLE_NAME, null, eventBatches)
                if (result == -1L) {
                    logger.log(LogLevel.Error, "Failed to insert batched event = $eventId")
                    return false
                }
            }
            writableDatabase.setTransactionSuccessful()
            return true
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun getEventPackets(eventIds: List<String>): List<EventPacket> {
        if (eventIds.isEmpty()) {
            return emptyList()
        }
        readableDatabase.rawQuery(Sql.getEventsForIds(eventIds), null).use {
            val eventPackets = mutableListOf<EventPacket>()
            while (it.moveToNext()) {
                val eventIdIndex = it.getColumnIndex(EventTable.COL_ID)
                val sessionIdIndex = it.getColumnIndex(EventTable.COL_SESSION_ID)
                val timestampIndex = it.getColumnIndex(EventTable.COL_TIMESTAMP)
                val userTriggeredIndex = it.getColumnIndex(EventTable.COL_USER_TRIGGERED)
                val typeIndex = it.getColumnIndex(EventTable.COL_TYPE)
                val serializedDataIndex = it.getColumnIndex(EventTable.COL_DATA_SERIALIZED)
                val serializedDataFilePathIndex = it.getColumnIndex(EventTable.COL_DATA_FILE_PATH)
                val attachmentsIndex = it.getColumnIndex(EventTable.COL_ATTACHMENTS)
                val serializedAttributesIndex = it.getColumnIndex(EventTable.COL_ATTRIBUTES)
                val serializedUserDefinedAttributesIndex =
                    it.getColumnIndex(EventTable.COL_USER_DEFINED_ATTRIBUTES)

                val eventId = it.getString(eventIdIndex)
                val sessionId = it.getString(sessionIdIndex)
                val timestamp = it.getString(timestampIndex)
                val userTriggered = it.getInt(userTriggeredIndex) == 1
                val type = it.getString(typeIndex)
                val serializedData = it.getString(serializedDataIndex)
                val serializedDataFilePath = it.getString(serializedDataFilePathIndex)
                val attachments = it.getString(attachmentsIndex)
                val serializedAttributes = it.getString(serializedAttributesIndex)
                val serializedUserDefinedAttributes =
                    it.getString(serializedUserDefinedAttributesIndex)

                eventPackets.add(
                    EventPacket(
                        eventId,
                        sessionId,
                        timestamp,
                        type,
                        userTriggered,
                        serializedData,
                        serializedDataFilePath,
                        attachments,
                        serializedAttributes,
                        serializedUserDefinedAttributes,
                    ),
                )
            }
            return eventPackets
        }
    }

    override fun getSpanPackets(spanIds: List<String>): List<SpanPacket> {
        if (spanIds.isEmpty()) {
            return emptyList()
        }
        readableDatabase.rawQuery(Sql.getSpansForIds(spanIds), null).use {
            val spanPackets = mutableListOf<SpanPacket>()
            while (it.moveToNext()) {
                val nameIndex = it.getColumnIndex(SpansTable.COL_NAME)
                val sessionIdIndex = it.getColumnIndex(SpansTable.COL_SESSION_ID)
                val spanIdIndex = it.getColumnIndex(SpansTable.COL_SPAN_ID)
                val traceIdIndex = it.getColumnIndex(SpansTable.COL_TRACE_ID)
                val parentIdIndex = it.getColumnIndex(SpansTable.COL_PARENT_ID)
                val startTimeIndex = it.getColumnIndex(SpansTable.COL_START_TIME)
                val endTimeIndex = it.getColumnIndex(SpansTable.COL_END_TIME)
                val durationIndex = it.getColumnIndex(SpansTable.COL_DURATION)
                val statusIndex = it.getColumnIndex(SpansTable.COL_STATUS)
                val serializedAttrsIndex = it.getColumnIndex(SpansTable.COL_SERIALIZED_ATTRS)
                val serializedUserDefAttrsIndex =
                    it.getColumnIndex(SpansTable.COL_SERIALIZED_USER_DEFINED_ATTRS)
                val serializedCheckpointsIndex =
                    it.getColumnIndex(SpansTable.COL_SERIALIZED_SPAN_EVENTS)

                val name = it.getString(nameIndex)
                val sessionId = it.getString(sessionIdIndex)
                val spanId = it.getString(spanIdIndex)
                val traceId = it.getString(traceIdIndex)
                val parentId = it.getString(parentIdIndex)
                val startTime = it.getLong(startTimeIndex)
                val endTime = it.getLong(endTimeIndex)
                val duration = it.getLong(durationIndex)
                val status = it.getInt(statusIndex)
                val serializedAttrs = it.getString(serializedAttrsIndex)
                val serializedUserDefAttrs = it.getString(serializedUserDefAttrsIndex)
                val serializedCheckpoints = it.getString(serializedCheckpointsIndex)

                spanPackets.add(
                    SpanPacket(
                        name = name,
                        traceId = traceId,
                        spanId = spanId,
                        sessionId = sessionId,
                        parentId = parentId,
                        startTime = startTime.iso8601Timestamp(),
                        endTime = endTime.iso8601Timestamp(),
                        duration = duration,
                        status = status,
                        serializedAttributes = serializedAttrs,
                        serializedUserDefAttrs = serializedUserDefAttrs,
                        serializedCheckpoints = serializedCheckpoints,
                    ),
                )
            }
            return spanPackets
        }
    }

    override fun getAttachmentPackets(eventIds: List<String>): List<AttachmentPacket> {
        readableDatabase.rawQuery(Sql.getAttachmentsForEventIds(eventIds), null).use {
            val attachmentPackets = mutableListOf<AttachmentPacket>()
            while (it.moveToNext()) {
                val idIndex = it.getColumnIndex(AttachmentTable.COL_ID)
                val filePathIndex = it.getColumnIndex(AttachmentTable.COL_FILE_PATH)

                val id = it.getString(idIndex)
                val filePath = it.getString(filePathIndex)

                attachmentPackets.add(AttachmentPacket(id, filePath))
            }
            return attachmentPackets
        }
    }

    override fun deleteBatch(batchId: String, eventIds: List<String>, spanIds: List<String>) {
        writableDatabase.beginTransaction()
        try {
            val batchesDeleteResult = writableDatabase.delete(
                BatchesTable.TABLE_NAME,
                "${BatchesTable.COL_BATCH_ID} = ?",
                arrayOf(batchId),
            )

            var eventsDeleteResult: Int? = null
            if (eventIds.isNotEmpty()) {
                eventsDeleteResult = writableDatabase.delete(
                    EventTable.TABLE_NAME,
                    "${EventTable.COL_ID} IN (${eventIds.joinToString { "?" }})",
                    eventIds.toTypedArray(),
                )
            }

            var spansDeleteResult: Int? = null
            if (spanIds.isNotEmpty()) {
                spansDeleteResult = writableDatabase.delete(
                    SpansTable.TABLE_NAME,
                    "${SpansTable.COL_SPAN_ID} IN (${spanIds.joinToString { "?" }})",
                    spanIds.toTypedArray(),
                )
            }

            if (batchesDeleteResult == 0 || eventsDeleteResult == 0 || spansDeleteResult == 0) {
                logger.log(LogLevel.Error, "Failed to delete batch, $batchId")
                return
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun getBatches(maxBatches: Int): List<Batch> {
        readableDatabase.beginTransaction()
        val batches = mutableListOf<Batch>()
        val batchIds = mutableListOf<String>()

        try {
            readableDatabase.rawQuery(Sql.getBatches(maxBatches), null).use {
                while (it.moveToNext()) {
                    val batchIdIndex = it.getColumnIndex(BatchesTable.COL_BATCH_ID)
                    val batchId = it.getString(batchIdIndex)
                    batchIds.add(batchId)
                }
                if (batchIds.isEmpty()) {
                    return emptyList()
                }
            }

            val batchToEventIds = mutableMapOf<String, MutableList<String>>()
            readableDatabase.rawQuery(Sql.getBatchedEventIds(batchIds), null).use {
                while (it.moveToNext()) {
                    val eventIdIndex = it.getColumnIndex(EventsBatchTable.COL_EVENT_ID)
                    val batchIdIndex = it.getColumnIndex(EventsBatchTable.COL_BATCH_ID)
                    val eventId = it.getString(eventIdIndex)
                    val batchId = it.getString(batchIdIndex)
                    batchToEventIds.getOrPut(batchId) { mutableListOf() }.add(eventId)
                }
            }

            val batchToSpanIds = mutableMapOf<String, MutableList<String>>()
            readableDatabase.rawQuery(Sql.getBatchedSpanIds(batchIds), null).use {
                while (it.moveToNext()) {
                    val spanIdIndex = it.getColumnIndex(SpansBatchTable.COL_SPAN_ID)
                    val batchIdIndex = it.getColumnIndex(SpansBatchTable.COL_BATCH_ID)
                    val spanId = it.getString(spanIdIndex)
                    val batchId = it.getString(batchIdIndex)
                    batchToSpanIds.getOrPut(batchId) { mutableListOf() }.add(spanId)
                }
            }

            for (batchId in batchIds) {
                batches.add(
                    Batch(
                        batchId = batchId,
                        eventIds = batchToEventIds[batchId] ?: emptyList(),
                        spanIds = batchToSpanIds[batchId] ?: emptyList(),
                    ),
                )
            }

            readableDatabase.setTransactionSuccessful()
            return batches
        } finally {
            readableDatabase.endTransaction()
        }
    }

    override fun insertSession(session: SessionEntity): Boolean {
        writableDatabase.beginTransaction()
        try {
            val sessionValues = ContentValues().apply {
                put(SessionsTable.COL_SESSION_ID, session.sessionId)
                put(SessionsTable.COL_PID, session.pid)
                put(SessionsTable.COL_CREATED_AT, session.createdAt)
                put(SessionsTable.COL_NEEDS_REPORTING, session.needsReporting)
                put(SessionsTable.COL_CRASHED, session.crashed)
            }
            val appExitResult = if (session.supportsAppExit) {
                val appExitValues = ContentValues().apply {
                    put(AppExitTable.COL_SESSION_ID, session.sessionId)
                    put(AppExitTable.COL_PID, session.pid)
                    put(AppExitTable.COL_CREATED_AT, session.createdAt)
                    put(AppExitTable.COL_APP_VERSION, session.appVersion)
                    put(AppExitTable.COL_APP_BUILD, session.appBuild)
                }
                writableDatabase.insertWithOnConflict(
                    AppExitTable.TABLE_NAME,
                    null,
                    appExitValues,
                    SQLiteDatabase.CONFLICT_IGNORE,
                )
            } else {
                0
            }

            val sessionsResult =
                writableDatabase.insert(SessionsTable.TABLE_NAME, null, sessionValues)
            if (sessionsResult == -1L || appExitResult == -1L) {
                logger.log(LogLevel.Error, "Failed to insert session ${session.sessionId}")
                return false
            }
            writableDatabase.setTransactionSuccessful()
            return true
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to insert session ${session.sessionId}", e)
            return false
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun updateSessionPid(
        sessionId: String,
        pid: Int,
        createdAt: Long,
        supportsAppExit: Boolean,
    ): Boolean {
        writableDatabase.beginTransaction()

        try {
            val sessionValues = ContentValues().apply {
                put(SessionsTable.COL_PID, pid)
            }
            val sessionResult = writableDatabase.updateWithOnConflict(
                SessionsTable.TABLE_NAME,
                sessionValues,
                "${SessionsTable.COL_SESSION_ID} = ?",
                arrayOf(sessionId),
                SQLiteDatabase.CONFLICT_IGNORE,
            )
            val appExitResult = if (supportsAppExit) {
                val appExitValues = ContentValues().apply {
                    put(AppExitTable.COL_SESSION_ID, sessionId)
                    put(AppExitTable.COL_PID, pid)
                    put(AppExitTable.COL_CREATED_AT, createdAt)
                }
                writableDatabase.insertWithOnConflict(
                    AppExitTable.TABLE_NAME,
                    null,
                    appExitValues,
                    SQLiteDatabase.CONFLICT_IGNORE,
                )
            } else {
                0
            }

            if (appExitResult < 0 || sessionResult <= 0) {
                logger.log(LogLevel.Error, "Unable to update session $sessionId")
                return false
            }
            writableDatabase.setTransactionSuccessful()
            return true
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Unable to update session $sessionId", e)
            return false
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun deleteSessions(sessionIds: List<String>): Boolean {
        if (sessionIds.isEmpty()) {
            return false
        }

        val placeholders = sessionIds.joinToString { "?" }
        val whereClause = "${SessionsTable.COL_SESSION_ID} IN ($placeholders)"
        val result = writableDatabase.delete(
            SessionsTable.TABLE_NAME,
            whereClause,
            sessionIds.toTypedArray(),
        )
        if (result == 0) {
            logger.log(LogLevel.Error, "Failed to delete sessions")
        }
        return result != 0
    }

    override fun getEvents(eventIds: List<String>): List<EventEntity> {
        val attachmentEntities = mutableListOf<AttachmentEntity>()
        readableDatabase.rawQuery(Sql.getAttachmentsForEventIds(eventIds), null).use {
            while (it.moveToNext()) {
                val attachmentIdIndex = it.getColumnIndex(AttachmentTable.COL_ID)
                val typeIndex = it.getColumnIndex(AttachmentTable.COL_TYPE)
                val filePathIndex = it.getColumnIndex(AttachmentTable.COL_FILE_PATH)
                val nameIndex = it.getColumnIndex(AttachmentTable.COL_NAME)

                val attachmentId = it.getString(attachmentIdIndex)
                val type = it.getString(typeIndex)
                val filePath = it.getString(filePathIndex)
                val name = it.getString(nameIndex)

                attachmentEntities.add(
                    AttachmentEntity(
                        id = attachmentId,
                        type = type,
                        path = filePath,
                        name = name,
                    ),
                )
            }
        }
        val eventEntities = mutableListOf<EventEntity>()
        readableDatabase.rawQuery(Sql.getEventsForIds(eventIds), null).use {
            while (it.moveToNext()) {
                val eventIdIndex = it.getColumnIndex(EventTable.COL_ID)
                val sessionIdIndex = it.getColumnIndex(EventTable.COL_SESSION_ID)
                val timestampIndex = it.getColumnIndex(EventTable.COL_TIMESTAMP)
                val userTriggeredIndex = it.getColumnIndex(EventTable.COL_USER_TRIGGERED)
                val typeIndex = it.getColumnIndex(EventTable.COL_TYPE)
                val serializedDataIndex = it.getColumnIndex(EventTable.COL_DATA_SERIALIZED)
                val serializedDataFilePathIndex = it.getColumnIndex(EventTable.COL_DATA_FILE_PATH)
                val attachmentsIndex = it.getColumnIndex(EventTable.COL_ATTACHMENTS)
                val serializedAttributesIndex = it.getColumnIndex(EventTable.COL_ATTRIBUTES)
                val serializedUserDefinedAttributesIndex =
                    it.getColumnIndex(EventTable.COL_USER_DEFINED_ATTRIBUTES)
                val attachmentsSizeIndex = it.getColumnIndex(EventTable.COL_ATTACHMENT_SIZE)

                val eventId = it.getString(eventIdIndex)
                val sessionId = it.getString(sessionIdIndex)
                val timestamp = it.getString(timestampIndex)
                val userTriggered = it.getInt(userTriggeredIndex) == 1
                val type = it.getString(typeIndex)
                val serializedData = it.getString(serializedDataIndex)
                val serializedDataFilePath = it.getString(serializedDataFilePathIndex)
                val attachments = it.getString(attachmentsIndex)
                val serializedAttributes = it.getString(serializedAttributesIndex)
                val serializedUserDefinedAttributes =
                    it.getString(serializedUserDefinedAttributesIndex)
                val attachmentsSize = it.getLong(attachmentsSizeIndex)

                eventEntities.add(
                    EventEntity(
                        id = eventId,
                        sessionId = sessionId,
                        timestamp = timestamp,
                        userTriggered = userTriggered,
                        type = type,
                        serializedData = serializedData,
                        filePath = serializedDataFilePath,
                        serializedAttributes = serializedAttributes,
                        serializedAttachments = attachments,
                        attachmentEntities = attachmentEntities,
                        attachmentsSize = attachmentsSize,
                        serializedUserDefAttributes = serializedUserDefinedAttributes,
                    ),
                )
            }
        }
        return eventEntities
    }

    override fun getEventsForSessions(sessions: List<String>): List<String> {
        if (sessions.isEmpty()) {
            return emptyList()
        }
        val eventIds = mutableListOf<String>()
        readableDatabase.rawQuery(Sql.getEventsForSessions(sessions), null).use {
            while (it.moveToNext()) {
                val eventIdIndex = it.getColumnIndex(EventTable.COL_ID)
                val eventId = it.getString(eventIdIndex)
                eventIds.add(eventId)
            }
        }
        return eventIds
    }

    override fun markCrashedSession(sessionId: String) {
        writableDatabase.execSQL(Sql.markSessionCrashed(sessionId))
    }

    override fun markCrashedSessions(sessionIds: List<String>) {
        writableDatabase.execSQL(Sql.markSessionsCrashed(sessionIds))
    }

    override fun getSessionIds(
        needReporting: Boolean,
        filterSessionIds: List<String>,
        maxCount: Int,
    ): List<String> {
        val sessionIds = mutableListOf<String>()
        readableDatabase.rawQuery(Sql.getSessions(needReporting, filterSessionIds, maxCount), null)
            .use {
                while (it.moveToNext()) {
                    val sessionIdIndex = it.getColumnIndex(SessionsTable.COL_SESSION_ID)
                    val sessionId = it.getString(sessionIdIndex)
                    sessionIds.add(sessionId)
                }
            }
        return sessionIds
    }

    override fun getOldestSession(): String? {
        val sessionId: String
        readableDatabase.rawQuery(Sql.getOldestSession(), null).use {
            if (it.count == 0) {
                return null
            }
            it.moveToFirst()
            val sessionIdIndex = it.getColumnIndex(SessionsTable.COL_SESSION_ID)
            sessionId = it.getString(sessionIdIndex)
        }
        return sessionId
    }

    override fun getEventsCount(): Int {
        val count: Int
        readableDatabase.rawQuery(Sql.getEventsCount(), null).use {
            it.moveToFirst()
            val countIndex = it.getColumnIndex("count")
            count = it.getInt(countIndex)
        }
        return count
    }

    override fun getSpansCount(): Int {
        val count: Int
        readableDatabase.rawQuery(Sql.getSpansCount(), null).use {
            it.moveToFirst()
            val countIndex = it.getColumnIndex("count")
            count = it.getInt(countIndex)
        }
        return count
    }

    override fun insertSignals(
        eventEntities: List<EventEntity>,
        spanEntities: List<SpanEntity>,
    ): Boolean {
        writableDatabase.beginTransaction()
        try {
            // Batch insert events
            eventEntities.forEach { event ->
                val values = ContentValues(11).apply {
                    put(EventTable.COL_ID, event.id)
                    put(EventTable.COL_TYPE, event.type)
                    put(EventTable.COL_TIMESTAMP, event.timestamp)
                    put(EventTable.COL_SESSION_ID, event.sessionId)
                    put(EventTable.COL_USER_TRIGGERED, event.userTriggered)
                    if (event.filePath != null) {
                        put(EventTable.COL_DATA_FILE_PATH, event.filePath)
                    } else if (event.serializedData != null) {
                        put(EventTable.COL_DATA_SERIALIZED, event.serializedData)
                    }
                    put(EventTable.COL_ATTRIBUTES, event.serializedAttributes)
                    put(EventTable.COL_USER_DEFINED_ATTRIBUTES, event.serializedUserDefAttributes)
                    put(EventTable.COL_ATTACHMENT_SIZE, event.attachmentsSize)
                    put(EventTable.COL_ATTACHMENTS, event.serializedAttachments)
                }

                if (writableDatabase.insert(EventTable.TABLE_NAME, null, values) == -1L) {
                    return false
                }

                // Batch insert attachments for this event
                event.attachmentEntities?.forEach { attachment ->
                    val attachmentValues = ContentValues(7).apply {
                        put(AttachmentTable.COL_ID, attachment.id)
                        put(AttachmentTable.COL_EVENT_ID, event.id)
                        put(AttachmentTable.COL_TYPE, attachment.type)
                        put(AttachmentTable.COL_TIMESTAMP, event.timestamp)
                        put(AttachmentTable.COL_SESSION_ID, event.sessionId)
                        put(AttachmentTable.COL_FILE_PATH, attachment.path)
                        put(AttachmentTable.COL_NAME, attachment.name)
                    }

                    if (writableDatabase.insert(
                            AttachmentTable.TABLE_NAME,
                            null,
                            attachmentValues,
                        ) == -1L
                    ) {
                        return false
                    }
                }
            }

            // Batch insert spans
            spanEntities.forEach { span ->
                val values = ContentValues(12).apply {
                    put(SpansTable.COL_NAME, span.name)
                    put(SpansTable.COL_SESSION_ID, span.sessionId)
                    put(SpansTable.COL_SPAN_ID, span.spanId)
                    put(SpansTable.COL_TRACE_ID, span.traceId)
                    put(SpansTable.COL_PARENT_ID, span.parentId)
                    put(SpansTable.COL_START_TIME, span.startTime)
                    put(SpansTable.COL_END_TIME, span.endTime)
                    put(SpansTable.COL_DURATION, span.duration)
                    put(SpansTable.COL_SERIALIZED_ATTRS, span.serializedAttributes)
                    put(
                        SpansTable.COL_SERIALIZED_USER_DEFINED_ATTRS,
                        span.serializedUserDefinedAttrs,
                    )
                    put(SpansTable.COL_SERIALIZED_SPAN_EVENTS, span.serializedCheckpoints)
                    put(SpansTable.COL_SAMPLED, span.sampled)
                    put(SpansTable.COL_STATUS, span.status.value)
                }

                if (writableDatabase.insert(SpansTable.TABLE_NAME, null, values) == -1L) {
                    return false
                }
            }

            writableDatabase.setTransactionSuccessful()
            return true
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to insert signals", e)
            return false
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun markSessionWithBugReport(sessionId: String) {
        writableDatabase.execSQL(Sql.markSessionWithBugReport(sessionId))
    }

    override fun getSessionForAppExit(pid: Int): AppExitCollector.Session? {
        readableDatabase.rawQuery(Sql.getSessionForAppExit(pid), null).use {
            if (it.count == 0) {
                return null
            }
            it.moveToFirst()
            val sessionIdIndex = it.getColumnIndex(AppExitTable.COL_SESSION_ID)
            val createdAtIndex = it.getColumnIndex(AppExitTable.COL_CREATED_AT)
            val appVersionIndex = it.getColumnIndex(AppExitTable.COL_APP_VERSION)
            val appBuildIndex = it.getColumnIndex(AppExitTable.COL_APP_BUILD)

            val sessionId = it.getString(sessionIdIndex)
            val createdAt = it.getLong(createdAtIndex)
            val appVersion: String? = it.getString(appVersionIndex)
            val appBuild: String? = it.getString(appBuildIndex)

            return AppExitCollector.Session(
                id = sessionId,
                createdAt = createdAt,
                pid = pid,
                appVersion = appVersion,
                appBuild = appBuild,
            )
        }
    }

    override fun clearAppExitSessionsBefore(timestamp: Long) {
        val result = writableDatabase.delete(
            AppExitTable.TABLE_NAME,
            "${AppExitTable.COL_CREATED_AT} <= ?",
            arrayOf(timestamp.toString()),
        )
        logger.log(LogLevel.Debug, "Cleared $result app_exit rows")
    }

    override fun insertSpan(spanEntity: SpanEntity): Boolean {
        val values = ContentValues().apply {
            put(SpansTable.COL_NAME, spanEntity.name)
            put(SpansTable.COL_SESSION_ID, spanEntity.sessionId)
            put(SpansTable.COL_SPAN_ID, spanEntity.spanId)
            put(SpansTable.COL_TRACE_ID, spanEntity.traceId)
            put(SpansTable.COL_PARENT_ID, spanEntity.parentId)
            put(SpansTable.COL_START_TIME, spanEntity.startTime)
            put(SpansTable.COL_END_TIME, spanEntity.endTime)
            put(SpansTable.COL_DURATION, spanEntity.duration)
            put(SpansTable.COL_SERIALIZED_ATTRS, spanEntity.serializedAttributes)
            put(SpansTable.COL_SERIALIZED_USER_DEFINED_ATTRS, spanEntity.serializedUserDefinedAttrs)
            put(SpansTable.COL_SERIALIZED_SPAN_EVENTS, spanEntity.serializedCheckpoints)
            put(SpansTable.COL_SAMPLED, spanEntity.sampled)
            put(SpansTable.COL_STATUS, spanEntity.status.value)
        }
        val result = writableDatabase.insert(
            SpansTable.TABLE_NAME,
            null,
            values,
        )
        return result != -1L
    }

    override fun getAttachmentsForEvents(events: List<String>): List<String> {
        val attachmentIds = mutableListOf<String>()
        readableDatabase.rawQuery(Sql.getAttachmentsForEvents(events), null).use {
            while (it.moveToNext()) {
                val attachmentIdIndex = it.getColumnIndex(AttachmentTable.COL_ID)
                val attachmentId = it.getString(attachmentIdIndex)
                attachmentIds.add(attachmentId)
            }
        }
        return attachmentIds
    }

    override fun close() {
        writableDatabase.close()
        super.close()
    }
}
