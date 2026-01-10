package sh.measure.android.storage

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteConstraintException
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteDatabase.CONFLICT_IGNORE
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
import kotlinx.serialization.encodeToString
import sh.measure.android.appexit.AppExitCollector
import sh.measure.android.events.EventType
import sh.measure.android.exporter.AttachmentPacket
import sh.measure.android.exporter.Batch
import sh.measure.android.exporter.EventPacket
import sh.measure.android.exporter.SignedAttachment
import sh.measure.android.exporter.SpanPacket
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.iso8601Timestamp
import java.io.Closeable

/**
 * Database abstraction for storing and retrieving SDK data including sessions, events, spans,
 * attachments, and batches.
 */
internal interface Database : Closeable {

    // ========================================================================================
    // Sessions
    // ========================================================================================

    /**
     * Inserts a new session and creates an app exit info entry.
     *
     * @param session The session entity to insert.
     * @return `true` if successful, `false` otherwise.
     */
    fun insertSession(session: SessionEntity): Boolean

    /**
     * Deletes a session and all associated data (events, spans, attachments) via cascade.
     *
     * @param sessionId The session ID to delete.
     * @return `true` if the session was deleted, `false` if not found or deletion failed.
     */
    fun deleteSession(sessionId: String): Boolean

    /**
     * Returns all session IDs except the specified one.
     *
     * @param excludeSessionId The session ID to exclude from results.
     */
    fun getSessionIds(excludeSessionId: String): List<String>

    /**
     * Returns the session ID of the oldest session, or `null` if no sessions exist.
     */
    fun getOldestSession(): String?

    /**
     * Updates all journey events for a given session as sampled.
     */
    fun sampleJourneyEvents(sessionId: String, journeyEventTypes: List<EventType>)

    // ========================================================================================
    // Events
    // ========================================================================================

    /**
     * Inserts an event and its associated attachments in a single transaction.
     *
     * @param event The event entity to insert.
     * @return `true` if successful, `false` otherwise.
     */
    fun insertEvent(event: EventEntity): Boolean

    /**
     * Retrieves event packets for the given event IDs.
     *
     * @param eventIds The event IDs to retrieve.
     * @return List of event packets, empty if none found.
     */
    fun getEventPackets(eventIds: List<String>): List<EventPacket>

    /**
     * Returns all event IDs belonging to a session.
     *
     * @param session The session ID.
     */
    fun getEventsForSession(session: String): List<String>

    /**
     * Returns the total count of events across all sessions.
     */
    fun getEventsCount(): Int

    /**
     * Returns the count of events for a specific session.
     *
     * @param sessionId The session ID.
     */
    fun getEventsCount(sessionId: String): Int

    /**
     * Deletes events not belonging to the specified session.
     *
     * @param excludeSessionId The session ID whose events should be preserved.
     * @param batchSize Maximum number of events to delete.
     * @return List of deleted event IDs.
     */
    fun deleteEvents(excludeSessionId: String, batchSize: Int): List<String>

    /**
     * Marks events within a time window for priority reporting (e.g., around a bug report).
     *
     * @param timestamp Center timestamp of the window (ISO 8601).
     * @param durationSeconds Window extends this many seconds before and after timestamp.
     * @param sessionId The session to mark as priority.
     */
    fun markTimelineForReporting(timestamp: String, durationSeconds: Int, sessionId: String)

    // ========================================================================================
    // Spans
    // ========================================================================================

    /**
     * Inserts a span.
     *
     * @param spanEntity The span entity to insert.
     * @return `true` if successful, `false` otherwise.
     */
    fun insertSpan(spanEntity: SpanEntity): Boolean

    /**
     * Retrieves span packets for the given span IDs.
     *
     * @param spanIds The span IDs to retrieve.
     * @return List of span packets, empty if none found.
     */
    fun getSpanPackets(spanIds: List<String>): List<SpanPacket>

    /**
     * Returns the total count of spans across all sessions.
     */
    fun getSpansCount(): Int

    /**
     * Returns the count of spans for a specific session.
     *
     * @param sessionId The session ID.
     */
    fun getSpansCount(sessionId: String): Int

    /**
     * Deletes spans not belonging to the specified session.
     *
     * @param excludeSessionId The session ID whose spans should be preserved.
     * @param batchSize Maximum number of spans to delete.
     * @return List of deleted span IDs.
     */
    fun deleteSpans(excludeSessionId: String, batchSize: Int): List<String>

    // ========================================================================================
    // Bulk Signal Operations
    // ========================================================================================

    /**
     * Inserts multiple events and spans in a single transaction.
     *
     * @param eventEntities The events to insert.
     * @param spanEntities The spans to insert.
     * @return `true` if all inserts succeeded, `false` if any failed (transaction rolled back).
     */
    fun insertSignals(eventEntities: List<EventEntity>, spanEntities: List<SpanEntity>): Boolean

    // ========================================================================================
    // Attachments
    // ========================================================================================

    /**
     * Returns attachment IDs for the given event IDs.
     *
     * @param events The event IDs to query.
     */
    fun getAttachmentsForEvents(events: List<String>): List<String>

    /**
     * Returns attachments ready for upload (have signed URLs that haven't expired).
     *
     * @param maxCount Maximum number of attachments to return.
     */
    fun getAttachmentsToUpload(maxCount: Int): List<AttachmentPacket>

    /**
     * Updates attachment records with signed upload URLs and expiration timestamps.
     *
     * @param signedAttachments The signed attachment data from the server.
     * @return `true` if all updates succeeded, `false` otherwise.
     */
    fun updateAttachmentUrls(signedAttachments: List<SignedAttachment>): Boolean

    /**
     * Deletes a single attachment.
     *
     * @param attachmentId The attachment ID to delete.
     * @return `true` if deleted, `false` if not found or deletion failed.
     */
    fun deleteAttachment(attachmentId: String): Boolean

    /**
     * Deletes multiple attachments.
     *
     * @param attachmentIds The attachment IDs to delete.
     */
    fun deleteAttachments(attachmentIds: List<String>)

    // ========================================================================================
    // Batching
    // ========================================================================================

    /**
     * Inserts a batch record linking events and spans for export.
     *
     * @param batchEntity The batch entity containing event and span IDs.
     * @return `true` if successful, `false` otherwise.
     */
    fun insertBatch(batchEntity: BatchEntity): Boolean

    /**
     * Deletes a batch and its associated events and spans.
     *
     * @param batchId The batch ID to delete.
     * @param eventIds The event IDs in the batch.
     * @param spanIds The span IDs in the batch.
     */
    fun deleteBatch(batchId: String, eventIds: List<String>, spanIds: List<String>)

    /**
     * Creates batches from sessions that have unbatched signals ready for export.
     * Groups events and spans into batches respecting size limits.
     *
     * @param idProvider Provider for generating batch IDs.
     * @param timeProvider Provider for timestamps.
     * @param maxBatchSize Maximum signals (events + spans) per batch.
     * @param insertionBatchSize Threshold for flushing to database during batch creation.
     * @return Number of batches created.
     */
    fun batchSessions(
        idProvider: IdProvider,
        timeProvider: TimeProvider,
        maxBatchSize: Int,
        insertionBatchSize: Int,
    ): Int

    /**
     * Returns all existing batches.
     */
    fun getBatchIds(): List<String>

    /**
     * Returns a batch with given id.
     *
     * @param batchId The batch ID.
     */
    fun getBatch(batchId: String): Batch

    // ========================================================================================
    // App Exit Tracking
    // ========================================================================================

    /**
     * Returns session data for app exit attribution based on process ID.
     * If multiple sessions share the same PID, returns the most recent one.
     *
     * @param pid The process ID to look up.
     * @return Session data if found, `null` otherwise.
     */
    fun getSessionForAppExit(pid: Int): AppExitCollector.Session?

    /**
     * Deletes all app exit records in AppExit table except for the
     * provided [excludeSessionId].
     *
     * @param excludeSessionId The session ID to exclude from deletion.
     */
    fun clearAppExitRecords(excludeSessionId: String)
}

/**
 * SQLite implementation of the Database interface.
 *
 * Uses WAL mode for improved concurrent read/write performance and enables foreign key
 * constraints for referential integrity.
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
            db.execSQL(Sql.CREATE_ATTACHMENTS_V1_TABLE)
            db.execSQL(Sql.CREATE_BATCHES_TABLE)
            db.execSQL(Sql.CREATE_EVENTS_BATCH_TABLE)
            db.execSQL(Sql.CREATE_APP_EXIT_TABLE)
            db.execSQL(Sql.CREATE_SPANS_TABLE)
            db.execSQL(Sql.CREATE_SPANS_BATCH_TABLE)
            db.execSQL(Sql.CREATE_EVENTS_TIMESTAMP_INDEX)
            db.execSQL(Sql.CREATE_EVENTS_SESSION_ID_INDEX)
            db.execSQL(Sql.CREATE_EVENTS_BATCH_EVENT_ID_INDEX)
            db.execSQL(Sql.CREATE_SESSIONS_CREATED_AT_INDEX)
            db.execSQL(Sql.CREATE_SPANS_SESSION_SAMPLED_INDEX)
            db.execSQL(Sql.CREATE_SPANS_BATCH_SPAN_ID_INDEX)
            db.execSQL(Sql.CREATE_APP_EXIT_PID_INDEX)
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Debug, "Failed to create database", e)
        }
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        DbMigrations.apply(logger, db, oldVersion, newVersion)
    }

    override fun onConfigure(db: SQLiteDatabase) {
        setWriteAheadLoggingEnabled(true)
        db.setForeignKeyConstraintsEnabled(true)
    }

    // ========================================================================================
    // Sessions
    // ========================================================================================

    @SuppressLint("UseKtx")
    override fun insertSession(session: SessionEntity): Boolean {
        writableDatabase.beginTransaction()
        try {
            val sessionValues = ContentValues().apply {
                put(SessionsTable.COL_SESSION_ID, session.sessionId)
                put(SessionsTable.COL_PID, 0)
                put(SessionsTable.COL_CREATED_AT, session.createdAt)
                put(SessionsTable.COL_PRIORITY_SESSION, session.prioritySession)
                put(SessionsTable.COL_CRASHED, false)
                put(SessionsTable.COL_TRACK_JOURNEY, session.trackJourney)
            }
            if (session.supportsAppExit) {
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
                    CONFLICT_IGNORE,
                )
            }

            val sessionsResult =
                writableDatabase.insert(SessionsTable.TABLE_NAME, null, sessionValues)
            if (sessionsResult == -1L) {
                logger.log(LogLevel.Debug, "Failed to insert session(${session.sessionId})")
                return false
            }
            writableDatabase.setTransactionSuccessful()
            return true
        } catch (e: Exception) {
            logger.log(LogLevel.Debug, "Failed to insert session(${session.sessionId})", e)
            return false
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun deleteSession(sessionId: String): Boolean {
        val result = writableDatabase.delete(
            SessionsTable.TABLE_NAME,
            "${SessionsTable.COL_SESSION_ID} = ?",
            arrayOf(sessionId),
        )
        if (result == 0) {
            logger.log(LogLevel.Debug, "Failed to delete session")
        }
        return result != 0
    }

    override fun getSessionIds(excludeSessionId: String): List<String> {
        val sessionIds = mutableListOf<String>()
        readableDatabase.rawQuery(Sql.getSessionIds(excludeSessionId), null)
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

    override fun sampleJourneyEvents(sessionId: String, journeyEventTypes: List<EventType>) {
        if (journeyEventTypes.isEmpty()) return

        val placeholders = journeyEventTypes.joinToString(",") { "?" }
        val args = arrayOf(sessionId) + journeyEventTypes.map { it.value }.toTypedArray()

        writableDatabase.update(
            EventTable.TABLE_NAME,
            ContentValues().apply {
                put(EventTable.COL_SAMPLED, true)
            },
            "${EventTable.COL_SESSION_ID} = ? AND ${EventTable.COL_TYPE} IN ($placeholders)",
            args,
        )
    }

    // ========================================================================================
    // Events
    // ========================================================================================

    @SuppressLint("UseKtx")
    override fun insertEvent(event: EventEntity): Boolean {
        writableDatabase.beginTransaction()
        try {
            val values = ContentValues().apply {
                put(EventTable.COL_ID, event.id)
                put(EventTable.COL_TYPE, event.type.value)
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
                put(EventTable.COL_SAMPLED, event.isSampled)
            }

            val result = writableDatabase.insert(EventTable.TABLE_NAME, null, values)
            if (result == -1L) {
                logger.log(LogLevel.Debug, "Failed to insert event ${event.type}")
                return false
            }

            event.attachmentEntities?.forEach { attachment ->
                val attachmentValues = ContentValues().apply {
                    put(AttachmentV1Table.COL_ID, attachment.id)
                    put(AttachmentV1Table.COL_EVENT_ID, event.id)
                    put(AttachmentV1Table.COL_TYPE, attachment.type)
                    put(AttachmentV1Table.COL_TIMESTAMP, event.timestamp)
                    put(AttachmentV1Table.COL_SESSION_ID, event.sessionId)
                    put(AttachmentV1Table.COL_FILE_PATH, attachment.path)
                    put(AttachmentV1Table.COL_NAME, attachment.name)
                }
                val attachmentResult =
                    writableDatabase.insert(AttachmentV1Table.TABLE_NAME, null, attachmentValues)
                if (attachmentResult == -1L) {
                    logger.log(
                        LogLevel.Debug,
                        "Failed to insert attachment(${attachment.type}) for event(${event.type})",
                    )
                    return false
                }
            }
            writableDatabase.setTransactionSuccessful()
            return true
        } catch (e: SQLiteConstraintException) {
            // Expected if session insertion failed before event was triggered.
            // Can happen for exceptions/ANRs written on main thread while session insertion
            // happens in background.
            logger.log(
                LogLevel.Debug,
                "Failed to insert event(${event.type}) for session(${event.sessionId})",
                e,
            )
            return false
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
                val eventType = EventType.fromValue(type)
                    ?: throw IllegalArgumentException("Unknown event type: $type")
                eventPackets.add(
                    EventPacket(
                        eventId,
                        sessionId,
                        timestamp,
                        eventType,
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

    override fun getEventsForSession(session: String): List<String> {
        val eventIds = mutableListOf<String>()
        readableDatabase.rawQuery(Sql.getEventsForSession(session), null).use {
            while (it.moveToNext()) {
                val eventIdIndex = it.getColumnIndex(EventTable.COL_ID)
                val eventId = it.getString(eventIdIndex)
                eventIds.add(eventId)
            }
        }
        return eventIds
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

    override fun getEventsCount(sessionId: String): Int {
        val count = readableDatabase.rawQuery(Sql.getEventsCount(sessionId), null).use {
            if (it.count == 0) {
                return 0
            }
            it.moveToFirst()
            val countIndex = it.getColumnIndex("count")
            it.getInt(countIndex)
        }
        return count
    }

    override fun deleteEvents(excludeSessionId: String, batchSize: Int): List<String> {
        val eventIds = mutableListOf<String>()

        readableDatabase.rawQuery(Sql.getEventsForDeletion(excludeSessionId, batchSize), null).use {
            while (it.moveToNext()) {
                val idIndex = it.getColumnIndex(EventTable.COL_ID)
                eventIds.add(it.getString(idIndex))
            }
        }

        if (eventIds.isEmpty()) {
            return emptyList()
        }

        val placeholders = eventIds.joinToString(",") { "?" }
        val deletedCount = writableDatabase.delete(
            EventTable.TABLE_NAME,
            "${EventTable.COL_ID} IN ($placeholders)",
            eventIds.toTypedArray(),
        )

        return if (deletedCount > 0) eventIds else emptyList()
    }

    @SuppressLint("UseKtx")
    override fun markTimelineForReporting(
        timestamp: String,
        durationSeconds: Int,
        sessionId: String,
    ) {
        writableDatabase.beginTransaction()
        try {
            writableDatabase
                .compileStatement(Sql.markTimelineForReporting(timestamp, durationSeconds))
                .use { statement ->
                    val eventRowsUpdated = statement.executeUpdateDelete()
                    logger.log(
                        LogLevel.Debug,
                        "Database: Marked $eventRowsUpdated timeline events for reporting",
                    )
                }

            writableDatabase
                .compileStatement(Sql.markSessionAsPriority(sessionId))
                .use { statement ->
                    val sessionsUpdated = statement.executeUpdateDelete()
                    if (sessionsUpdated > 0) {
                        logger.log(
                            LogLevel.Debug,
                            "Database: Marked session $sessionId as priority",
                        )
                    }
                }

            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    // ========================================================================================
    // Spans
    // ========================================================================================

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

    override fun getSpansCount(): Int {
        val count: Int
        readableDatabase.rawQuery(Sql.getSpansCount(), null).use {
            it.moveToFirst()
            val countIndex = it.getColumnIndex("count")
            count = it.getInt(countIndex)
        }
        return count
    }

    override fun getSpansCount(sessionId: String): Int {
        val count = readableDatabase.rawQuery(Sql.getSpansCount(sessionId), null).use {
            if (it.count == 0) {
                return 0
            }
            it.moveToFirst()
            val countIndex = it.getColumnIndex("count")
            it.getInt(countIndex)
        }
        return count
    }

    override fun deleteSpans(excludeSessionId: String, batchSize: Int): List<String> {
        val spanIds = mutableListOf<String>()

        readableDatabase.rawQuery(Sql.getSpansForDeletion(excludeSessionId, batchSize), null).use {
            while (it.moveToNext()) {
                val idIndex = it.getColumnIndex(SpansTable.COL_SPAN_ID)
                spanIds.add(it.getString(idIndex))
            }
        }

        if (spanIds.isEmpty()) {
            return emptyList()
        }

        val placeholders = spanIds.joinToString(",") { "?" }
        val deletedCount = writableDatabase.delete(
            SpansTable.TABLE_NAME,
            "${SpansTable.COL_SPAN_ID} IN ($placeholders)",
            spanIds.toTypedArray(),
        )

        return if (deletedCount > 0) spanIds else emptyList()
    }

    @SuppressLint("UseKtx")
    override fun insertSignals(
        eventEntities: List<EventEntity>,
        spanEntities: List<SpanEntity>,
    ): Boolean {
        writableDatabase.beginTransaction()
        try {
            eventEntities.forEach { event ->
                val values = ContentValues(11).apply {
                    put(EventTable.COL_ID, event.id)
                    put(EventTable.COL_TYPE, event.type.value)
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
                    put(EventTable.COL_SAMPLED, event.isSampled)
                }

                if (writableDatabase.insert(EventTable.TABLE_NAME, null, values) == -1L) {
                    return false
                }

                event.attachmentEntities?.forEach { attachment ->
                    val attachmentValues = ContentValues(7).apply {
                        put(AttachmentV1Table.COL_ID, attachment.id)
                        put(AttachmentV1Table.COL_EVENT_ID, event.id)
                        put(AttachmentV1Table.COL_TYPE, attachment.type)
                        put(AttachmentV1Table.COL_TIMESTAMP, event.timestamp)
                        put(AttachmentV1Table.COL_SESSION_ID, event.sessionId)
                        put(AttachmentV1Table.COL_FILE_PATH, attachment.path)
                        put(AttachmentV1Table.COL_NAME, attachment.name)
                    }

                    if (writableDatabase.insert(
                            AttachmentV1Table.TABLE_NAME,
                            null,
                            attachmentValues,
                        ) == -1L
                    ) {
                        return false
                    }
                }
            }

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
            logger.log(LogLevel.Debug, "Failed to insert signals", e)
            return false
        } finally {
            writableDatabase.endTransaction()
        }
    }

    // ========================================================================================
    // Attachments
    // ========================================================================================

    override fun getAttachmentsForEvents(events: List<String>): List<String> {
        val attachmentIds = mutableListOf<String>()
        readableDatabase.rawQuery(Sql.getAttachmentsForEvents(events), null).use { cursor ->
            val attachmentIdIndex = cursor.getColumnIndex(AttachmentV1Table.COL_ID)
            if (attachmentIdIndex == -1) {
                return attachmentIds
            }
            while (cursor.moveToNext()) {
                val attachmentId = cursor.getString(attachmentIdIndex)
                attachmentIds.add(attachmentId)
            }
        }
        return attachmentIds
    }

    override fun getAttachmentsToUpload(maxCount: Int): List<AttachmentPacket> {
        val attachments = mutableListOf<AttachmentPacket>()
        try {
            readableDatabase.rawQuery(Sql.getAttachmentsToUpload(maxCount), null).use {
                while (it.moveToNext()) {
                    val idIndex = it.getColumnIndex(AttachmentV1Table.COL_ID)
                    val urlIndex = it.getColumnIndex(AttachmentV1Table.COL_UPLOAD_URL)
                    val expiresAtIndex = it.getColumnIndex(AttachmentV1Table.COL_URL_EXPIRES_AT)
                    val typeIndex = it.getColumnIndex(AttachmentV1Table.COL_TYPE)
                    val nameIndex = it.getColumnIndex(AttachmentV1Table.COL_NAME)
                    val filePathIndex = it.getColumnIndex(AttachmentV1Table.COL_FILE_PATH)
                    val sessionIdIndex = it.getColumnIndex(AttachmentV1Table.COL_SESSION_ID)
                    val headersIndex = it.getColumnIndex(AttachmentV1Table.COL_URL_HEADERS)

                    val id = it.getString(idIndex)
                    val url = it.getString(urlIndex)
                    val expiresAt = it.getString(expiresAtIndex)
                    val type = it.getString(typeIndex)
                    val name = it.getString(nameIndex)
                    val filePath = it.getString(filePathIndex)
                    val sessionId = it.getString(sessionIdIndex)
                    val headers = it.getString(headersIndex)
                    attachments.add(
                        AttachmentPacket(
                            id = id,
                            url = url,
                            type = type,
                            expiresAt = expiresAt,
                            name = name,
                            path = filePath,
                            sessionId = sessionId,
                            headers = jsonSerializer.decodeFromString(headers),
                        ),
                    )
                }
            }
            return attachments
        } catch (e: Exception) {
            logger.log(LogLevel.Debug, "Failed to get attachments to upload", e)
            return emptyList()
        }
    }

    @SuppressLint("UseKtx")
    override fun updateAttachmentUrls(signedAttachments: List<SignedAttachment>): Boolean {
        if (signedAttachments.isEmpty()) {
            return true
        }

        writableDatabase.beginTransaction()
        try {
            signedAttachments.forEach { attachment ->
                val values = ContentValues().apply {
                    put(AttachmentV1Table.COL_UPLOAD_URL, attachment.uploadUrl)
                    put(AttachmentV1Table.COL_URL_EXPIRES_AT, attachment.expiresAt)
                    put(
                        AttachmentV1Table.COL_URL_HEADERS,
                        jsonSerializer.encodeToString(attachment.headers),
                    )
                }

                val result = writableDatabase.update(
                    AttachmentV1Table.TABLE_NAME,
                    values,
                    "${AttachmentV1Table.COL_ID} = ?",
                    arrayOf(attachment.id),
                )

                if (result == 0) {
                    return false
                }
            }
            writableDatabase.setTransactionSuccessful()
            return true
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun deleteAttachment(attachmentId: String): Boolean = try {
        val rowsDeleted = writableDatabase.delete(
            AttachmentV1Table.TABLE_NAME,
            "${AttachmentV1Table.COL_ID} = ?",
            arrayOf(attachmentId),
        )
        rowsDeleted > 0
    } catch (e: Exception) {
        logger.log(LogLevel.Error, "Failed to delete attachment $attachmentId", e)
        false
    }

    override fun deleteAttachments(attachmentIds: List<String>) {
        if (attachmentIds.isEmpty()) {
            return
        }
        val placeholders = attachmentIds.joinToString { "?" }
        val whereClause = "${AttachmentV1Table.COL_ID} IN ($placeholders)"
        writableDatabase.delete(
            AttachmentV1Table.TABLE_NAME,
            whereClause,
            attachmentIds.toTypedArray(),
        )
    }

    // ========================================================================================
    // Batching
    // ========================================================================================

    @SuppressLint("UseKtx")
    override fun insertBatch(batchEntity: BatchEntity): Boolean {
        writableDatabase.beginTransaction()
        try {
            val batches = ContentValues().apply {
                put(BatchesTable.COL_BATCH_ID, batchEntity.batchId)
                put(BatchesTable.COL_CREATED_AT, batchEntity.createdAt)
            }

            writableDatabase.insertWithOnConflict(
                BatchesTable.TABLE_NAME,
                null,
                batches,
                CONFLICT_IGNORE,
            )
            batchEntity.spanIds.forEach { spanId ->
                val spanBatches = ContentValues().apply {
                    put(SpansBatchTable.COL_SPAN_ID, spanId)
                    put(SpansBatchTable.COL_BATCH_ID, batchEntity.batchId)
                    put(SpansBatchTable.COL_CREATED_AT, batchEntity.createdAt)
                }
                val result = writableDatabase.insert(SpansBatchTable.TABLE_NAME, null, spanBatches)
                if (result == -1L) {
                    logger.log(LogLevel.Debug, "Failed to insert span($spanId)")
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
                    logger.log(LogLevel.Debug, "Failed to insert event($eventId)")
                    return false
                }
            }
            writableDatabase.setTransactionSuccessful()
            return true
        } finally {
            writableDatabase.endTransaction()
        }
    }

    @SuppressLint("UseKtx")
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
                logger.log(LogLevel.Debug, "Failed to delete batch($batchId)")
                return
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun batchSessions(
        idProvider: IdProvider,
        timeProvider: TimeProvider,
        maxBatchSize: Int,
        insertionBatchSize: Int,
    ): Int {
        var batchesInserted = 0

        val sessionIds = getSessionsToBatch()
        if (sessionIds.isEmpty()) {
            return batchesInserted
        }

        var currentBatchId = idProvider.uuid()
        var currentBatchSize = 0
        val eventIds = mutableSetOf<String>()
        val spanIds = mutableSetOf<String>()

        fun insertToDb() {
            if (eventIds.isEmpty() && spanIds.isEmpty()) return
            val inserted = insertBatch(
                BatchEntity(
                    batchId = currentBatchId,
                    createdAt = timeProvider.now(),
                    eventIds = eventIds.toSet(),
                    spanIds = spanIds.toSet(),
                ),
            )
            if (inserted) batchesInserted++
            eventIds.clear()
            spanIds.clear()
        }

        fun createNewBatch() {
            insertToDb()
            currentBatchId = idProvider.uuid()
            currentBatchSize = 0
        }

        fun addEvent(id: String) {
            eventIds.add(id)
            currentBatchSize++
            if (currentBatchSize >= maxBatchSize) {
                createNewBatch()
            } else if (eventIds.size + spanIds.size >= insertionBatchSize) {
                insertToDb()
            }
        }

        fun addSpan(id: String) {
            spanIds.add(id)
            currentBatchSize++
            if (currentBatchSize >= maxBatchSize) {
                createNewBatch()
            } else if (eventIds.size + spanIds.size >= insertionBatchSize) {
                insertToDb()
            }
        }

        for (sessionId in sessionIds) {
            forEachEvent(Sql.getSampledEvents(sessionId), ::addEvent)
            forEachSpan(Sql.getSampledSpans(sessionId), ::addSpan)
        }

        // Insert any remaining events/spans
        insertToDb()

        return batchesInserted
    }

    override fun getBatchIds(): List<String> {
        val batchIds = mutableListOf<String>()
        readableDatabase.rawQuery(Sql.getBatchIds(), null).use {
            while (it.moveToNext()) {
                val batchIdIndex = it.getColumnIndex(BatchesTable.COL_BATCH_ID)
                batchIds.add(it.getString(batchIdIndex))
            }
        }
        return batchIds
    }

    override fun getBatch(batchId: String): Batch {
        val eventIds = mutableListOf<String>()
        val spanIds = mutableListOf<String>()
        readableDatabase.rawQuery(Sql.getBatchedEventIds(listOf(batchId)), null).use {
            while (it.moveToNext()) {
                val eventIdIndex = it.getColumnIndex(EventsBatchTable.COL_EVENT_ID)
                eventIds.add(it.getString(eventIdIndex))
            }
        }

        readableDatabase.rawQuery(Sql.getBatchedSpanIds(listOf(batchId)), null).use {
            while (it.moveToNext()) {
                val spanIdIndex = it.getColumnIndex(SpansBatchTable.COL_SPAN_ID)
                spanIds.add(it.getString(spanIdIndex))
            }
        }

        return Batch(
            batchId = batchId,
            eventIds = eventIds,
            spanIds = spanIds,
        )
    }

    // ========================================================================================
    // App Exit Tracking
    // ========================================================================================

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

    override fun clearAppExitRecords(excludeSessionId: String) {
        writableDatabase.delete(
            AppExitTable.TABLE_NAME,
            "${AppExitTable.COL_SESSION_ID} != ?",
            arrayOf(excludeSessionId),
        )
    }

    override fun close() {
        writableDatabase.close()
        super.close()
    }

    private fun getSessionsToBatch(): List<String> {
        val query = Sql.getSessionsToBatch()
        val sessionIds = mutableListOf<String>()
        readableDatabase.rawQuery(query, null).use { cursor ->
            while (cursor.moveToNext()) {
                val sessionIdIndex = cursor.getColumnIndex(SessionsTable.COL_SESSION_ID)
                sessionIds.add(cursor.getString(sessionIdIndex))
            }
        }
        return sessionIds
    }

    private inline fun forEachEvent(query: String, action: (String) -> Unit) {
        readableDatabase.rawQuery(query, null).use { cursor ->
            val idIndex = cursor.getColumnIndex(EventTable.COL_ID)
            while (cursor.moveToNext()) {
                action(cursor.getString(idIndex))
            }
        }
    }

    private inline fun forEachSpan(query: String, action: (String) -> Unit) {
        readableDatabase.rawQuery(query, null).use { cursor ->
            val idIndex = cursor.getColumnIndex(SpansTable.COL_SPAN_ID)
            while (cursor.moveToNext()) {
                action(cursor.getString(idIndex))
            }
        }
    }
}
