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
     * @return a map of event Id to the size of attachments in the event in bytes.
     */
    fun getUnBatchedEventsWithAttachmentSize(
        eventCount: Int,
        ascending: Boolean = true,
    ): LinkedHashMap<String, Long>

    /**
     * Inserts a batch of event IDs along with their assigned batch ID.
     *
     * @param eventIds The list of event IDs to insert.
     * @param batchId The batch ID to assign to the events.
     * @param createdAt The creation time of the batch.
     * @return `true` if the events were successfully inserted, `false` otherwise.
     */
    fun insertBatch(eventIds: List<String>, batchId: String, createdAt: Long): Boolean

    /**
     * Inserts a batch with a single event Id.
     *
     * @param eventId The event ID to insert.
     * @param batchId The batch ID to assign to the event.
     * @param createdAt The creation time of the batch.
     * @return `true` if the event was successfully inserted, `false` otherwise.
     */
    fun insertBatch(eventId: String, batchId: String, createdAt: Long): Boolean

    /**
     * Returns a list of event packets for the given event IDs.
     *
     * @param eventIds The list of event IDs to get event packets for.
     */
    fun getEventPackets(eventIds: List<String>): List<EventPacket>

    /**
     * Returns a event packet for the given event ID.
     *
     * @param eventId The event ID to get event packet for.
     */
    fun getEventPacket(eventId: String): EventPacket

    /**
     * Returns a list of attachment packets for the given event IDs.
     *
     * @param eventIds The list of event IDs to fetch attachments for.
     */
    fun getAttachmentPackets(eventIds: List<String>): List<AttachmentPacket>

    /**
     * Returns a list of attachment packets for the given event IDs.
     *
     * @param eventId The event ID to fetch attachments for.
     */
    fun getAttachmentPacket(eventId: String): List<AttachmentPacket>

    /**
     * Deletes the events with the given IDs, along with related metadata.
     *
     * @param eventIds The list of event IDs to delete.
     */
    fun deleteEvents(eventIds: List<String>)

    /**
     * Deletes the event with the given ID, along with related metadata.
     *
     * @param eventId The event ID to delete.
     */
    fun deleteEvent(eventId: String)

    /**
     * Returns a map of batch IDs to event IDs that have not been synced with the server in
     * ascending order of creation time.
     *
     * @param maxBatches The maximum number of batches to return.
     * @return a map of batch ID to list of event IDs.
     */
    fun getBatches(maxBatches: Int): LinkedHashMap<String, MutableList<String>>

    /**
     * Inserts a session ID and process ID into the database.
     *
     * @param sessionId the session id.
     * @param pid the process id.
     * @param createdAt the creation time of the session.
     */
    fun insertSession(sessionId: String, pid: Int, createdAt: Long): Boolean

    /**
     * Returns a map of process IDs to list of session IDs that were created by that process.
     */
    fun getSessionsForPids(): Map<Int, List<String>>

    /**
     * Cleans up old sessions that were created before the given time.
     *
     * @param clearUpToTimeSinceEpoch The time before which the sessions should be deleted.
     */
    fun clearOldSessions(clearUpToTimeSinceEpoch: Long)
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
            db.execSQL(Sql.CREATE_EVENTS_TABLE)
            db.execSQL(Sql.CREATE_ATTACHMENTS_TABLE)
            db.execSQL(Sql.CREATE_EVENTS_BATCH_TABLE)
            db.execSQL(Sql.CREATE_SESSIONS_TABLE)
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
                if (event.filePath != null) {
                    put(EventTable.COL_DATA_FILE_PATH, event.filePath)
                } else if (event.serializedData != null) {
                    put(EventTable.COL_DATA_SERIALIZED, event.serializedData)
                }
                put(EventTable.COL_ATTRIBUTES, event.serializedAttributes)
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
    ): LinkedHashMap<String, Long> {
        val query = Sql.getEventsBatchQuery(eventCount, ascending)
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

    override fun insertBatch(
        eventIds: List<String>,
        batchId: String,
        createdAt: Long,
    ): Boolean {
        writableDatabase.beginTransaction()
        try {
            eventIds.forEach { eventId ->
                val values = ContentValues().apply {
                    put(EventsBatchTable.COL_EVENT_ID, eventId)
                    put(EventsBatchTable.COL_BATCH_ID, batchId)
                    put(EventsBatchTable.COL_CREATED_AT, createdAt)
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

    override fun insertBatch(eventId: String, batchId: String, createdAt: Long): Boolean {
        val values = ContentValues().apply {
            put(EventsBatchTable.COL_EVENT_ID, eventId)
            put(EventsBatchTable.COL_BATCH_ID, batchId)
            put(EventsBatchTable.COL_CREATED_AT, createdAt)
        }
        val result = writableDatabase.insert(EventsBatchTable.TABLE_NAME, null, values)
        if (result == -1L) {
            logger.log(LogLevel.Error, "Failed to insert batched event = $eventId")
        }
        return result != -1L
    }

    override fun getEventPackets(eventIds: List<String>): List<EventPacket> {
        readableDatabase.rawQuery(Sql.getEventsForIds(eventIds), null).use {
            val eventPackets = mutableListOf<EventPacket>()
            while (it.moveToNext()) {
                val eventIdIndex = it.getColumnIndex(EventTable.COL_ID)
                val sessionIdIndex = it.getColumnIndex(EventTable.COL_SESSION_ID)
                val timestampIndex = it.getColumnIndex(EventTable.COL_TIMESTAMP)
                val typeIndex = it.getColumnIndex(EventTable.COL_TYPE)
                val serializedDataIndex = it.getColumnIndex(EventTable.COL_DATA_SERIALIZED)
                val serializedDataFilePathIndex = it.getColumnIndex(EventTable.COL_DATA_FILE_PATH)
                val attachmentsIndex = it.getColumnIndex(EventTable.COL_ATTACHMENTS)
                val serializedAttributesIndex = it.getColumnIndex(EventTable.COL_ATTRIBUTES)

                val eventId = it.getString(eventIdIndex)
                val sessionId = it.getString(sessionIdIndex)
                val timestamp = it.getString(timestampIndex)
                val type = it.getString(typeIndex)
                val serializedData = it.getString(serializedDataIndex)
                val serializedDataFilePath = it.getString(serializedDataFilePathIndex)
                val attachments = it.getString(attachmentsIndex)
                val serializedAttributes = it.getString(serializedAttributesIndex)

                eventPackets.add(
                    EventPacket(
                        eventId,
                        sessionId,
                        timestamp,
                        type,
                        serializedData,
                        serializedDataFilePath,
                        attachments,
                        serializedAttributes,
                    ),
                )
            }
            return eventPackets
        }
    }

    override fun getEventPacket(eventId: String): EventPacket {
        readableDatabase.rawQuery(Sql.getEventForId(eventId), null).use {
            it.moveToFirst()
            val sessionIdIndex = it.getColumnIndex(EventTable.COL_SESSION_ID)
            val timestampIndex = it.getColumnIndex(EventTable.COL_TIMESTAMP)
            val typeIndex = it.getColumnIndex(EventTable.COL_TYPE)
            val serializedDataIndex = it.getColumnIndex(EventTable.COL_DATA_SERIALIZED)
            val serializedDataFilePathIndex = it.getColumnIndex(EventTable.COL_DATA_FILE_PATH)
            val attachmentsIndex = it.getColumnIndex(EventTable.COL_ATTACHMENTS)
            val serializedAttributesIndex = it.getColumnIndex(EventTable.COL_ATTRIBUTES)

            val sessionId = it.getString(sessionIdIndex)
            val timestamp = it.getString(timestampIndex)
            val type = it.getString(typeIndex)
            val serializedData = it.getString(serializedDataIndex)
            val serializedDataFilePath = it.getString(serializedDataFilePathIndex)
            val attachments = it.getString(attachmentsIndex)
            val serializedAttributes = it.getString(serializedAttributesIndex)

            return EventPacket(
                eventId,
                sessionId,
                timestamp,
                type,
                serializedData,
                serializedDataFilePath,
                attachments,
                serializedAttributes,
            )
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

    override fun getAttachmentPacket(eventId: String): List<AttachmentPacket> {
        readableDatabase.rawQuery(Sql.getAttachmentsForEventId(eventId), null).use {
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

    override fun deleteEvent(eventId: String) {
        deleteEvents(listOf(eventId))
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

    override fun insertSession(sessionId: String, pid: Int, createdAt: Long): Boolean {
        val values = ContentValues().apply {
            put(SessionsTable.COL_SESSION_ID, sessionId)
            put(SessionsTable.COL_PID, pid)
            put(SessionsTable.COL_CREATED_AT, createdAt)
        }

        val result = writableDatabase.insert(SessionsTable.TABLE_NAME, null, values)
        if (result == -1L) {
            logger.log(LogLevel.Error, "Failed to insert pid and session id")
        }
        return result != -1L
    }

    override fun getSessionsForPids(): Map<Int, List<String>> {
        readableDatabase.rawQuery(Sql.getSessionsForPids(), null).use {
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

    override fun clearOldSessions(clearUpToTimeSinceEpoch: Long) {
        writableDatabase.delete(
            SessionsTable.TABLE_NAME,
            "${SessionsTable.COL_CREATED_AT} <= ?",
            arrayOf(clearUpToTimeSinceEpoch.toString()),
        )
    }

    override fun close() {
        writableDatabase.close()
        super.close()
    }
}
