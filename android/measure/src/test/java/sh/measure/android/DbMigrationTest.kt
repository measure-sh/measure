package sh.measure.android

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import sh.measure.android.logger.Logger
import sh.measure.android.storage.DbMigrations
import sh.measure.android.storage.Sql

private class TestSQLiteOpenHelper(
    context: Context,
    private val logger: Logger,
) : SQLiteOpenHelper(context, "test.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
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
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        DbMigrations.apply(logger, db, oldVersion, newVersion)
    }
}
