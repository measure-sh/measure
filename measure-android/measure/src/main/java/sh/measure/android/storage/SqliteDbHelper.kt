package sh.measure.android.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
import okio.use
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.SessionDbConstants.CREATE_SESSION_TABLE
import sh.measure.android.storage.SessionDbConstants.SessionTable

internal interface DbHelper {
    fun createSession(contentValues: ContentValues)
    fun deleteSession(sessionId: String)
    fun getSessionStartTime(sessionId: String): Long
    fun getSyncedSessions(): List<String>
    fun deleteSessions(sessionIds: List<String>)
    fun getUnsyncedSessions(): List<UnsyncedSession>
}

/**
 * SQLite backed Database.
 *
 * ### Sqlite Configuration
 * We optimise for fast writes to ensure high performance for the application being instrumented.
 * Tradeoff is durability in rare scenarios and slightly slower reads in some cases. Read more:
 * * [WAL enabled](https://www.sqlite.org/wal.html)
 * * [synchronous = NORMAL](https://www.sqlite.org/pragma.html#pragma_synchronous)
 *
 * @param logger The logger to use for logging
 * @param context The application context
 */
internal class SqliteDbHelper(private val logger: Logger, context: Context) : DbHelper,
    SQLiteOpenHelper(context, Database.DATABASE_NAME, null, Database.DATABASE_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        logger.log(LogLevel.Debug, "Creating database")
        try {
            db.execSQL(CREATE_SESSION_TABLE)
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to create database", e)
        }
    }

    override fun onConfigure(db: SQLiteDatabase) {
        setWriteAheadLoggingEnabled(true)
        db.execSQL("PRAGMA synchronous = NORMAL")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // No-op
    }

    override fun createSession(contentValues: ContentValues) {
        logger.log(LogLevel.Debug, "Creating session in database")
        val result = writableDatabase.insert(
            SessionTable.TABLE_NAME, null, contentValues
        )
        if (result != -1L) {
            logger.log(LogLevel.Debug, "Session created in db")
        } else {
            logger.log(LogLevel.Error, "Failed to insert session into database")
        }
    }

    override fun deleteSession(sessionId: String) {
        val result = writableDatabase.delete(
            SessionTable.TABLE_NAME, "${SessionTable.COLUMN_SESSION_ID} = ?", arrayOf(sessionId)
        )
        if (result == 1) {
            logger.log(LogLevel.Debug, "Deleted session from database: $sessionId")
        } else {
            logger.log(LogLevel.Error, "Failed to delete session from database")
        }
    }

    override fun getSessionStartTime(sessionId: String): Long {
        return writableDatabase.query(
            SessionTable.TABLE_NAME,
            arrayOf(SessionTable.COLUMN_SESSION_START_TIME),
            "${SessionTable.COLUMN_SESSION_ID} = ?",
            arrayOf(sessionId),
            null,
            null,
            null
        ).use {
            if (it.moveToFirst()) {
                val sessionStartTimeIndex =
                    it.getColumnIndex(SessionTable.COLUMN_SESSION_START_TIME)
                it.getLong(sessionStartTimeIndex)
            } else {
                logger.log(LogLevel.Error, "Session $sessionId doesn't exist")
                throw IllegalStateException("Session $sessionId doesn't exist")
            }
        }
    }

    override fun getSyncedSessions(): List<String> {
        val syncedSessions = mutableListOf<String>()
        readableDatabase.query(
            SessionTable.TABLE_NAME,
            arrayOf(SessionTable.COLUMN_SESSION_ID),
            "${SessionTable.COLUMN_SYNCED} = ?",
            arrayOf("1"),
            null,
            null,
            null
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val sessionIdIndex = cursor.getColumnIndex(SessionTable.COLUMN_SESSION_ID)
                syncedSessions.add(cursor.getString(sessionIdIndex))
            }
        }
        return syncedSessions
    }

    override fun deleteSessions(sessionIds: List<String>) {
        // delete all sessions with ids in sessionIds
        writableDatabase.delete(
            SessionTable.TABLE_NAME, "${SessionTable.COLUMN_SESSION_ID} IN (${
                sessionIds.joinToString(
                    ","
                )
            })", null
        )
    }

    override fun getUnsyncedSessions(): List<UnsyncedSession> {
        val unsyncedSessions = mutableListOf<UnsyncedSession>()
        readableDatabase.query(
            SessionTable.TABLE_NAME, arrayOf(
                SessionTable.COLUMN_SESSION_ID,
                SessionTable.COLUMN_SESSION_START_TIME,
                SessionTable.COLUMN_PROCESS_ID
            ), "${SessionTable.COLUMN_SYNCED} = ?", arrayOf("0"), null, null, null
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val idIndex = cursor.getColumnIndex(SessionTable.COLUMN_SESSION_ID)
                val startTimeIndex =
                    cursor.getColumnIndex(SessionTable.COLUMN_SESSION_START_TIME)
                val processIdIndex = cursor.getColumnIndex(SessionTable.COLUMN_PROCESS_ID)
                val unsyncedSession = UnsyncedSession(
                    cursor.getString(idIndex),
                    cursor.getString(startTimeIndex),
                    cursor.getInt(processIdIndex)
                )
                unsyncedSessions.add(unsyncedSession)
            }
        }
        return unsyncedSessions
    }
}

