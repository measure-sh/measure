package sh.measure.android.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
import androidx.annotation.VisibleForTesting
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
     */
    fun insertEvent(event: EventEntity)

    /**
     * Returns a list of maximum [eventCount] event IDs that have not yet been batched. By default
     * events are returned in ascending order of timestamp, unless specified otherwise.
     *
     * @param eventCount The number of events to return.
     * @param ascending If `true`, the events are returned in ascending order of timestamp. Else,
     * in descending order.
     */
    fun getUnBatchedEventsWithAttachmentSize(
        eventCount: Int, ascending: Boolean = true
    ): LinkedHashMap<String, Long>

    /**
     * Inserts a batch of event IDs along with their assigned batch ID.
     *
     * @param eventIds The list of event IDs to insert.
     * @param batchId The batch ID to assign to the events.
     * @param createdAt The creation time of the batch.
     */
    fun insertBatch(eventIds: List<String>, batchId: String, createdAt: Long): Boolean

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
     */
    fun getBatches(maxBatches: Int): LinkedHashMap<String, MutableList<String>>
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

    override fun insertEvent(event: EventEntity) {
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
                        "Failed to insert attachment ${attachment.type} for event = ${event.type}"
                    )
                }
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun getUnBatchedEventsWithAttachmentSize(
        eventCount: Int, ascending: Boolean
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
        eventIds: List<String>, batchId: String, createdAt: Long
    ): Boolean {
        var isSuccess = true
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
                    isSuccess = false
                }
            }
            if (isSuccess) {
                writableDatabase.setTransactionSuccessful()
            }
        } finally {
            writableDatabase.endTransaction()
        }
        return isSuccess
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
                val timestamp = it.getLong(timestampIndex)
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
                        serializedAttributes
                    )
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
                val eventIdIndex = it.getColumnIndex(AttachmentTable.COL_EVENT_ID)
                val typeIndex = it.getColumnIndex(AttachmentTable.COL_TYPE)
                val filePathIndex = it.getColumnIndex(AttachmentTable.COL_FILE_PATH)
                val nameIndex = it.getColumnIndex(AttachmentTable.COL_NAME)

                val id = it.getString(idIndex)
                val eventId = it.getString(eventIdIndex)
                val type = it.getString(typeIndex)
                val filePath = it.getString(filePathIndex)
                val name = it.getString(nameIndex)

                attachmentPackets.add(AttachmentPacket(id, eventId, type, filePath, name))
            }
            return attachmentPackets
        }
    }

    override fun deleteEvents(eventIds: List<String>) {
        val result = writableDatabase.delete(
            EventTable.TABLE_NAME, "${EventTable.COL_ID} = ?", eventIds.toTypedArray()
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

    override fun close() {
        writableDatabase.close()
        super.close()
    }

    @VisibleForTesting
    internal fun getEventsCount(): Int {
        readableDatabase.rawQuery("SELECT COUNT(*) FROM ${EventTable.TABLE_NAME}", null).use {
                it.moveToFirst()
                return it.getInt(0)
            }
    }

    @VisibleForTesting
    internal fun getBatchesCount(): Int {
        readableDatabase.rawQuery("SELECT COUNT(*) FROM ${EventsBatchTable.TABLE_NAME}", null).use {
                it.moveToFirst()
                return it.getInt(0)
            }
    }
}
