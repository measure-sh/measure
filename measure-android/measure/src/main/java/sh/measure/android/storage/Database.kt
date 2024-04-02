package sh.measure.android.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal interface Database {
    fun insertEvent(event: EventEntity)
}

internal class DatabaseImpl(
    context: Context,
    private val logger: Logger,
) : SQLiteOpenHelper(context, DbConstants.DATABASE_NAME, null, DbConstants.DATABASE_VERSION),
    Database {
    override fun onCreate(db: SQLiteDatabase) {
        try {
            db.execSQL(Sql.CREATE_EVENTS_TABLE)
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to create database", e)
        }
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Not implemented
    }

    override fun onConfigure(db: SQLiteDatabase) {
        setWriteAheadLoggingEnabled(true)

        // TODO: review this
        db.execSQL("PRAGMA synchronous = NORMAL")
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
        } else {
            logger.log(LogLevel.Debug, "Event inserted = ${event.type}")
        }
    }
}