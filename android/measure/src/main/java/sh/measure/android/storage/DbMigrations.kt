package sh.measure.android.storage

import android.database.sqlite.SQLiteDatabase
import androidx.core.database.sqlite.transaction
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal object DbMigrations {
    fun apply(logger: Logger, db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        try {
            db.transaction {
                try {
                    // Apply migrations sequentially
                    for (version in oldVersion + 1..newVersion) {
                        when (version) {
                            DbVersion.V2 -> migrateToV2(this)
                            DbVersion.V3 -> migrateToV3(this)
                            DbVersion.V4 -> migrateToV4(this)
                            DbVersion.V5 -> migrateToV5(this)
                            DbVersion.V6 -> migrateToV6(this)
                            DbVersion.V7 -> migrateToV7(this)
                            else -> logger.log(
                                LogLevel.Debug,
                                "Db migration failed: $version not found ",
                            )
                        }
                    }
                } catch (e: Exception) {
                    logger.log(LogLevel.Debug, "Db migration failed", e)
                }
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Debug, "Db migration failed from $oldVersion->$newVersion", e)
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

    private fun migrateToV5(db: SQLiteDatabase) {
        // Step 1: Create new attachments_v1 table with updated schema
        db.execSQL(Sql.CREATE_ATTACHMENTS_V1_TABLE)

        // Step 2: Migrate existing data from old table to new table
        db.execSQL(
            """
        INSERT INTO ${AttachmentV1Table.TABLE_NAME} (
            ${AttachmentV1Table.COL_ID},
            ${AttachmentV1Table.COL_SESSION_ID},
            ${AttachmentV1Table.COL_EVENT_ID},
            ${AttachmentV1Table.COL_TYPE},
            ${AttachmentV1Table.COL_TIMESTAMP},
            ${AttachmentV1Table.COL_FILE_PATH},
            ${AttachmentV1Table.COL_NAME}
        )
        SELECT 
            ${AttachmentTable.COL_ID},
            ${AttachmentTable.COL_SESSION_ID},
            ${AttachmentTable.COL_EVENT_ID},
            ${AttachmentTable.COL_TYPE},
            ${AttachmentTable.COL_TIMESTAMP},
            ${AttachmentTable.COL_FILE_PATH},
            ${AttachmentTable.COL_NAME}
        FROM ${AttachmentTable.TABLE_NAME}
            """.trimIndent(),
        )

        // Step 3: Drop old table
        db.execSQL("DROP TABLE IF EXISTS ${AttachmentTable.TABLE_NAME}")
    }

    private fun migrateToV6(db: SQLiteDatabase) {
        db.execSQL("ALTER TABLE ${SessionsTable.TABLE_NAME} ADD COLUMN ${SessionsTable.COL_TRACK_JOURNEY} INTEGER DEFAULT NULL;")
    }

    private fun migrateToV7(db: SQLiteDatabase) {
        db.execSQL("ALTER TABLE ${EventTable.TABLE_NAME} ADD COLUMN ${EventTable.COL_SAMPLED} INTEGER DEFAULT 0;")
        db.execSQL("DROP INDEX IF EXISTS sessions_needs_reporting_index")
    }
}
