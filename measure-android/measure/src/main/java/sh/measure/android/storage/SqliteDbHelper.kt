package sh.measure.android.storage

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

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
internal class SqliteDbHelper(private val logger: Logger, context: Context) :
    SQLiteOpenHelper(context, Database.DATABASE_NAME, null, Database.DATABASE_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        logger.log(LogLevel.Debug, "Creating database")
        db.beginTransaction()
        try {
            db.execSQL(Sql.CREATE_SESSION_TABLE)
            db.execSQL(Sql.CREATE_SIGNALS_TABLE)
            db.setTransactionSuccessful()
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to create database", e)
        } finally {
            db.endTransaction()
        }
    }

    override fun onConfigure(db: SQLiteDatabase) {
        setWriteAheadLoggingEnabled(true)
        db.execSQL("PRAGMA synchronous = NORMAL")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // No-op
    }
}

