package sh.measure.android.database

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
import kotlinx.serialization.json.Json
import sh.measure.android.events.MeasureEvent
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

/**
 * Interface representing a database client.
 */
internal interface DbClient {
    fun insertEvent(event: MeasureEvent)
    fun deleteSyncedEvents(eventIds: List<String>)
    fun getUnSyncedEvents(): List<MeasureEvent>
}

private const val DATABASE_NAME = "measure.db"
private const val DATABASE_VERSION = 1
private const val TABLE_ENTRIES = "entries"
private const val COLUMN_ID = "id"
private const val COLUMN_TYPE = "type"
private const val COLUMN_DATA = "data"
private const val COLUMN_SYNCED = "synced"
private const val COLUMN_TIMESTAMP = "timestamp"

/**
 * Database client implementation using SQLite.
 *
 * The database stores all events (and potentially spans in the future) in a single table
 * called "entries". Each entry of the table is represented by [DbEntry].
 *
 * **Sqlite Configuration**
 * * WAL (Write-Ahead Logging) is enabled. This allows for concurrent reads and writes
 * and also allows for faster writes. Read more on [Sqlite WAL](https://www.sqlite.org/wal.html)
 * * Normal Synchronization mode: When using WAL, by default every commit issues an fsync to help
 * ensure that the data reaches the disk. This improves data durability but slows down commits. Note
 * that the data still reaches the disk even on crashes. Read more
 * on [Sqlite Synchronization](https://www.sqlite.org/pragma.html#pragma_synchronous)
 *
 * @param logger The logger to use for logging
 * @param context The application context
 */
internal class SqliteDbClient(private val logger: Logger, context: Context) : DbClient,
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        logger.log(LogLevel.Debug, "Creating database")
        val createTableQuery = """
            CREATE TABLE $TABLE_ENTRIES (
                $COLUMN_ID TEXT PRIMARY KEY NOT NULL,
                $COLUMN_TYPE TEXT NOT NULL,
                $COLUMN_DATA TEXT NOT NULL,
                $COLUMN_SYNCED INTEGER NOT NULL,
                $COLUMN_TIMESTAMP INTEGER NOT NULL
            )
        """
        try {
            db.execSQL(createTableQuery)
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to create database", e)
        }
    }

    override fun onConfigure(db: SQLiteDatabase) {
        setWriteAheadLoggingEnabled(true)
        db.execSQL("PRAGMA synchronous = NORMAL")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        TODO("onUpgrade not implemented, oldVersion:$oldVersion newVersion:$newVersion")
    }

    override fun insertEvent(event: MeasureEvent) {
        val dbEntry = event.toDbEntry()
        insert(dbEntry)
    }

    private fun insert(dbEntry: DbEntry) {
        logger.log(LogLevel.Debug, "Inserting entry into database: ${dbEntry.id}")
        val values = ContentValues().apply {
            put(COLUMN_ID, dbEntry.id)
            put(COLUMN_TYPE, dbEntry.type)
            put(COLUMN_DATA, dbEntry.data)
            put(COLUMN_SYNCED, dbEntry.synced)
            put(COLUMN_TIMESTAMP, dbEntry.timestamp)
        }

        val result: Long
        try {
            writableDatabase.use {
                result = it.insertWithOnConflict(
                    TABLE_ENTRIES, null, values, SQLiteDatabase.CONFLICT_FAIL
                )
            }
        } catch (e: SQLiteException) {
            logger.log(
                LogLevel.Error, "Failed to insert entry into database: ${dbEntry.id}", e
            )
            return
        }

        if (result == -1L) {
            logger.log(
                LogLevel.Error, "Failed to insert entry into database: ${dbEntry.id}"
            )
        } else {
            logger.log(LogLevel.Debug, "Inserted entry into database: ${dbEntry.id}")
        }
    }

    override fun deleteSyncedEvents(eventIds: List<String>) {
        logger.log(LogLevel.Debug, "Removing ${eventIds.count()} synced events from database")

        val whereClause = "$COLUMN_ID IN (${eventIds.joinToString(",") { "'$it'" }})"

        try {
            writableDatabase.use {
                it.delete(TABLE_ENTRIES, whereClause, null)
            }
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to remove synced events from database", e)
        }
    }

    override fun getUnSyncedEvents(): List<MeasureEvent> {
        val events = mutableListOf<MeasureEvent>()

        readableDatabase.use { db ->
            val cursor: Cursor = db.query(
                TABLE_ENTRIES, arrayOf(COLUMN_DATA), "$COLUMN_SYNCED = 0", null, null, null, null
            )
            cursor.use {
                while (it.moveToNext()) {
                    val dataColumnIndex = it.getColumnIndex(COLUMN_DATA)
                    assert(dataColumnIndex != -1)
                    val data = it.getString(dataColumnIndex)
                    events.add(Json.decodeFromString(MeasureEvent.serializer(), data))
                }
            }
        }

        return events
    }
}


