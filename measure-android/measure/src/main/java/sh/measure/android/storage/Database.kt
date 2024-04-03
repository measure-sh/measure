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
    fun insertEvent(event: EventEntity)
    fun insertAttachment(attachment: AttachmentEntity)
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
        }

        val result = writableDatabase.insert(EventTable.TABLE_NAME, null, values)
        if (result == -1L) {
            logger.log(LogLevel.Error, "Failed to insert event = ${event.type}")
        }
    }

    override fun insertAttachment(attachment: AttachmentEntity) {
        val values = ContentValues().apply {
            put(AttachmentTable.COL_ID, attachment.id)
            put(AttachmentTable.COL_PATH, attachment.path)
            put(AttachmentTable.COL_NAME, attachment.name)
            put(AttachmentTable.COL_EXTENSION, attachment.extension)
            put(AttachmentTable.COL_TYPE, attachment.type)
            put(AttachmentTable.COL_TIMESTAMP, attachment.timestamp)
            put(AttachmentTable.COL_ATTRIBUTES, attachment.serializedAttributes)
        }

        val result = writableDatabase.insert(AttachmentTable.TABLE_NAME, null, values)
        if (result == -1L) {
            logger.log(LogLevel.Error, "Failed to insert attachment = ${attachment.id}")
        }
    }

    override fun close() {
        writableDatabase.close()
        super.close()
    }
}