package sh.measure.android.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
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
    fun getEventsToBatch(eventCount: Int, ascending: Boolean = true): BatchEventEntity

    /**
     * Inserts a list of event IDs to be marked as "batched" into the database.
     */
    fun insertBatchedEventIds(eventIds: List<String>, batchId: String)
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
                    put(AttachmentTable.COL_EXTENSION, attachment.extension)
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

    override fun getEventsToBatch(eventCount: Int, ascending: Boolean): BatchEventEntity {
        val query = Sql.getEventsBatchQuery(eventCount, ascending)
        val cursor = readableDatabase.rawQuery(query, null)
        val eventIdAttachmentSizeMap = LinkedHashMap<String, Long>()
        var attachmentsSize = 0L

        cursor.use {
            while (it.moveToNext()) {
                val eventIdIndex = cursor.getColumnIndex(EventTable.COL_ID)
                val attachmentsSizeIndex = cursor.getColumnIndex(EventTable.COL_ATTACHMENT_SIZE)
                val eventId = cursor.getString(eventIdIndex)
                val attachmentSize = cursor.getLong(attachmentsSizeIndex)
                eventIdAttachmentSizeMap[eventId] = attachmentSize
                attachmentsSize += attachmentSize
            }
        }

        return BatchEventEntity(eventIdAttachmentSizeMap, attachmentsSize)
    }

    override fun insertBatchedEventIds(eventIds: List<String>, batchId: String) {
        writableDatabase.beginTransaction()
        try {
            eventIds.forEach { eventId ->
                val values = ContentValues().apply {
                    put(EventsBatchTable.COL_EVENT_ID, eventId)
                    put(EventsBatchTable.COL_BATCH_ID, batchId)
                }
                val result = writableDatabase.insert(EventsBatchTable.TABLE_NAME, null, values)
                if (result == -1L) {
                    logger.log(LogLevel.Error, "Failed to insert batched event = $eventId")
                }
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    override fun close() {
        writableDatabase.close()
        super.close()
    }
}
