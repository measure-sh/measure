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
                        DbVersion.V3 -> migrateToV3(db)
                        DbVersion.V4 -> migrateToV4(db)
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

    private fun migrateToV3(db: SQLiteDatabase) {
        db.execSQL(Sql.CREATE_SPANS_TABLE)
        db.execSQL(Sql.CREATE_BATCHES_TABLE)
        db.execSQL(Sql.CREATE_SPANS_BATCH_TABLE)
        db.execSQL(
            """
               INSERT INTO ${BatchesTable.TABLE_NAME}
                    (${BatchesTable.COL_BATCH_ID}, ${BatchesTable.COL_CREATED_AT})
                SELECT DISTINCT ${EventsBatchTable.COL_BATCH_ID}, MIN(${EventsBatchTable.COL_CREATED_AT})
                FROM ${EventsBatchTable.TABLE_NAME}
                GROUP BY ${EventsBatchTable.COL_BATCH_ID}
            """.trimIndent(),
        )
    }

    private fun migrateToV4(db: SQLiteDatabase) {
        db.execSQL("ALTER TABLE ${AppExitTable.TABLE_NAME} ADD COLUMN ${AppExitTable.COL_APP_BUILD} TEXT DEFAULT NULL;")
        db.execSQL("ALTER TABLE ${AppExitTable.TABLE_NAME} ADD COLUMN ${AppExitTable.COL_APP_VERSION} TEXT DEFAULT NULL;")
    }
}
