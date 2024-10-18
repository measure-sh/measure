package sh.measure.android.storage

import android.database.sqlite.SQLiteDatabase
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal object DbMigrations {
    fun apply(logger: Logger, db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        try {
            db.beginTransaction()
            try {
                // Apply migrations sequentially
                for (version in oldVersion + 1..newVersion) {
                    when (version) {
                        DbVersion.V2 -> migrateToV2(db)
                        else -> logger.log(
                            LogLevel.Warning,
                            "No migration found for version $version",
                        )
                    }
                }
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Unable to migrate db from $oldVersion->$newVersion", e)
        }
    }

    private fun migrateToV2(db: SQLiteDatabase) {
        db.execSQL(Sql.CREATE_APP_EXIT_TABLE)
        db.execSQL(
            """
            INSERT INTO ${AppExitTable.TABLE_NAME} 
                (${AppExitTable.COL_SESSION_ID}, ${AppExitTable.COL_PID}, ${AppExitTable.COL_CREATED_AT})
            SELECT ${SessionsTable.COL_SESSION_ID}, ${SessionsTable.COL_PID}, ${SessionsTable.COL_CREATED_AT}
            FROM ${SessionsTable.TABLE_NAME}
            WHERE ${SessionsTable.COL_APP_EXIT_TRACKED} = 0;
            """.trimIndent(),
        )
    }
}
