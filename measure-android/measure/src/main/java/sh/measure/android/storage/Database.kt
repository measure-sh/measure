package sh.measure.android.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
import sh.measure.android.exporter.AttachmentPacket
import sh.measure.android.exporter.EventPacket
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
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
     * Returns a list of attachment packets for the given event IDs.
     *
     * @param eventIds The list of event IDs to fetch attachments for.
     */
    fun getAttachmentPackets(eventIds: List<String>): List<AttachmentPacket>

    /**
     * Deletes the events with the given IDs, along with related metadata.
     *
     * @param eventIds The list of event IDs to delete.
     */
    fun deleteEvents(eventIds: List<String>)

    /**
     * Returns a map of batch IDs to event IDs that have not been synced with the server in
     * ascending order of creation time.
     *
     * @param maxBatches The maximum number of batches to return.
     * @return a map of batch ID to list of event IDs.
     */
    fun getBatches(maxBatches: Int): LinkedHashMap<String, MutableList<String>>

    /**
     * Inserts a session entity into the database.
     *
     * @param session the session entity to insert.
     */
    fun insertSession(session: SessionEntity): Boolean

    /**
     * Deletes the sessions with the given IDs.
     *
     * @param sessionIds The list of session IDs to delete.
     * @return `true` if the sessions were successfully deleted, `false` otherwise.
     */
    fun deleteSessions(sessionIds: List<String>): Boolean

    /**
     * Returns a map of process IDs to list of session IDs that were created by that process
     * where the app exit event has not been tracked. The session Ids are order by creation time
     * in ascending order.
     */
    fun getSessionsWithUntrackedAppExit(): Map<Int, List<String>>

    /**
     * Updates the sessions table to mark the app exit event as tracked.
     */
    fun updateAppExitTracked(pid: Int)

    /**
     * Inserts a user defined attribute into the database.
     */
    fun insertUserDefinedAttribute(key: String, value: Number)

    /**
     * Inserts a user defined attribute into the database.
     */
    fun insertUserDefinedAttribute(key: String, value: String)

    /**
     * Inserts a user defined attribute into the database.
     */
    fun insertUserDefinedAttribute(key: String, value: Boolean)

    /**
     * Returns all the user defined attributes stored in the database.
     */
    fun getUserDefinedAttributes(): Map<String, Any?>

    /**
     * Removes a user defined attribute from the database.
     */
    fun removeUserDefinedAttribute(key: String)

    /**
     * Clears all the user defined attributes stored in the database.
     */
    fun clearUserDefinedAttributes()

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
            db.execSQL(Sql.CREATE_EVENTS_BATCH_TABLE)
            db.execSQL(Sql.CREATE_USER_DEFINED_ATTRIBUTES_TABLE)
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
        // Not implemented
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

    override fun insertBatch(batchEntity: BatchEntity): Boolean {
        writableDatabase.beginTransaction()
        try {
            batchEntity.eventIds.forEach { eventId ->
                val values = ContentValues().apply {
                    put(EventsBatchTable.COL_EVENT_ID, eventId)
                    put(EventsBatchTable.COL_BATCH_ID, batchEntity.batchId)
                    put(EventsBatchTable.COL_CREATED_AT, batchEntity.createdAt)
                }
                val result = writableDatabase.insert(EventsBatchTable.TABLE_NAME, null, values)
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

    override fun deleteEvents(eventIds: List<String>) {
        if (eventIds.isEmpty()) {
            return
        }

        val placeholders = eventIds.joinToString { "?" }
        val whereClause = "${EventTable.COL_ID} IN ($placeholders)"
        val result = writableDatabase.delete(
            EventTable.TABLE_NAME,
            whereClause,
            eventIds.toTypedArray(),
        )
        if (result == 0) {
            logger.log(LogLevel.Error, "Failed to delete events")
        }
    }

    override fun getBatches(maxBatches: Int): LinkedHashMap<String, MutableList<String>> {
        readableDatabase.rawQuery(Sql.getBatches(maxBatches), null).use {
            val batchIdToEventIds = LinkedHashMap<String, MutableList<String>>()
            while (it.moveToNext()) {
                val eventIdIndex = it.getColumnIndex(EventsBatchTable.COL_EVENT_ID)
                val batchIdIndex = it.getColumnIndex(EventsBatchTable.COL_BATCH_ID)
                val eventId = it.getString(eventIdIndex)
                val batchId = it.getString(batchIdIndex)
                if (batchIdToEventIds.containsKey(batchId)) {
                    batchIdToEventIds[batchId]!!.add(eventId)
                } else {
                    batchIdToEventIds[batchId] = mutableListOf(eventId)
                }
            }
            return batchIdToEventIds
        }
    }

    override fun insertSession(session: SessionEntity): Boolean {
        val values = ContentValues().apply {
            put(SessionsTable.COL_SESSION_ID, session.sessionId)
            put(SessionsTable.COL_PID, session.pid)
            put(SessionsTable.COL_CREATED_AT, session.createdAt)
            put(SessionsTable.COL_NEEDS_REPORTING, session.needsReporting)
            put(SessionsTable.COL_CRASHED, session.crashed)
        }

        val result = writableDatabase.insert(SessionsTable.TABLE_NAME, null, values)
        if (result == -1L) {
            logger.log(LogLevel.Error, "Failed to insert pid and session id")
        }
        return result != -1L
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

    override fun getSessionsWithUntrackedAppExit(): Map<Int, List<String>> {
        readableDatabase.rawQuery(Sql.getSessionsWithUntrackedAppExit(), null).use {
            val pidToSessionsMap = linkedMapOf<Int, MutableList<String>>()

            while (it.moveToNext()) {
                val sessionIdIndex = it.getColumnIndex(SessionsTable.COL_SESSION_ID)
                val pidIndex = it.getColumnIndex(SessionsTable.COL_PID)

                val sessionId = it.getString(sessionIdIndex)
                val pid = it.getInt(pidIndex)

                if (pid in pidToSessionsMap) {
                    pidToSessionsMap[pid]!!.add(sessionId)
                } else {
                    pidToSessionsMap[pid] = mutableListOf(sessionId)
                }
            }

            return pidToSessionsMap
        }
    }

    override fun updateAppExitTracked(pid: Int) {
        writableDatabase.execSQL(Sql.updateAppExitTracked(pid))
    }

    override fun insertUserDefinedAttribute(key: String, value: Number) {
        val contentValues = ContentValues()
        contentValues.put(UserDefinedAttributesTable.COL_KEY, key)
        when (value) {
            is Int -> {
                contentValues.put(UserDefinedAttributesTable.COL_VALUE, value)
                contentValues.put(UserDefinedAttributesTable.COL_TYPE, "integer")
            }

            is Long -> {
                contentValues.put(UserDefinedAttributesTable.COL_VALUE, value)
                contentValues.put(UserDefinedAttributesTable.COL_TYPE, "long")
            }

            is Float -> {
                contentValues.put(UserDefinedAttributesTable.COL_VALUE, value)
                contentValues.put(UserDefinedAttributesTable.COL_TYPE, "float")
            }

            is Double -> {
                contentValues.put(UserDefinedAttributesTable.COL_VALUE, value)
                contentValues.put(UserDefinedAttributesTable.COL_TYPE, "double")
            }

            else -> {
                logger.log(
                    LogLevel.Error,
                    "Unsupported type for user defined attribute: $value",
                )
                return
            }
        }
        try {
            writableDatabase.insertWithOnConflict(
                UserDefinedAttributesTable.TABLE_NAME,
                null,
                contentValues,
                SQLiteDatabase.CONFLICT_REPLACE,
            )
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to insert user defined attribute", e)
        }
    }

    override fun insertUserDefinedAttribute(key: String, value: String) {
        val contentValues = ContentValues()
        contentValues.put(UserDefinedAttributesTable.COL_KEY, key)
        contentValues.put(UserDefinedAttributesTable.COL_VALUE, value)
        contentValues.put(UserDefinedAttributesTable.COL_TYPE, "string")
        try {
            writableDatabase.insertWithOnConflict(
                UserDefinedAttributesTable.TABLE_NAME,
                null,
                contentValues,
                SQLiteDatabase.CONFLICT_REPLACE,
            )
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to insert user defined attribute", e)
        }
    }

    override fun insertUserDefinedAttribute(key: String, value: Boolean) {
        val contentValues = ContentValues()
        contentValues.put(UserDefinedAttributesTable.COL_KEY, key)
        val intValue = if (value) 1 else 0
        contentValues.put(UserDefinedAttributesTable.COL_VALUE, intValue)
        contentValues.put(UserDefinedAttributesTable.COL_TYPE, "boolean")
        try {
            writableDatabase.insertWithOnConflict(
                UserDefinedAttributesTable.TABLE_NAME,
                null,
                contentValues,
                SQLiteDatabase.CONFLICT_REPLACE,
            )
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to insert user defined attribute", e)
        }
    }

    override fun getUserDefinedAttributes(): Map<String, Any?> {
        val attributes = mutableMapOf<String, Any?>()
        readableDatabase.rawQuery(Sql.getUserDefinedAttributes(), null).use {
            while (it.moveToNext()) {
                val keyIndex = it.getColumnIndex(UserDefinedAttributesTable.COL_KEY)
                val valueIndex = it.getColumnIndex(UserDefinedAttributesTable.COL_VALUE)
                val typeIndex = it.getColumnIndex(UserDefinedAttributesTable.COL_TYPE)
                val key = it.getString(keyIndex)
                val type = it.getString(typeIndex)
                val value = when (type) {
                    "integer" -> it.getInt(valueIndex)
                    "long" -> it.getLong(valueIndex)
                    "float" -> it.getFloat(valueIndex)
                    "double" -> it.getDouble(valueIndex)
                    "string" -> it.getString(valueIndex)
                    "boolean" -> it.getInt(valueIndex) == 1
                    else -> {
                        logger.log(LogLevel.Error, "Unsupported type for user defined attribute")
                        null
                    }
                }
                attributes[key] = value
            }
        }
        return attributes
    }

    override fun removeUserDefinedAttribute(key: String) {
        writableDatabase.delete(
            UserDefinedAttributesTable.TABLE_NAME,
            "${UserDefinedAttributesTable.COL_KEY} = ?",
            arrayOf(key),
        )
    }

    override fun clearUserDefinedAttributes() {
        writableDatabase.delete(UserDefinedAttributesTable.TABLE_NAME, null, null)
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
