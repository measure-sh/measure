package sh.measure.android.storage

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import androidx.test.platform.app.InstrumentationRegistry
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets

object TestDatabaseHelper {
    private const val TEST_DB_NAME = "test.db"
    private const val SCHEMAS_RESOURCE_PATH = "schemas"

    /**
     * Creates a database from a schema file located in the
     * src/test/resources/schemas directory.
     *
     * @param version The version of the schema file to use (e.g., 1 for schema_v1.sql).
     * @return SQLiteDatabase instance ready to use.
     * @throws RuntimeException if the schema file cannot be found or read.
     */
    fun createDatabase(version: Int): SQLiteDatabase {
        val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
        val dbFile = context.getDatabasePath(TEST_DB_NAME)
        dbFile.parentFile?.mkdirs()
        if (dbFile.exists()) {
            dbFile.delete()
        }
        val helper = object : SQLiteOpenHelper(context, TEST_DB_NAME, null, version) {
            override fun onCreate(db: SQLiteDatabase) {
            }

            override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            }
        }
        val db = helper.writableDatabase
        val schemaFileName = "schema_v$version.sql"
        val resourcePath = "$SCHEMAS_RESOURCE_PATH/$schemaFileName"
        try {
            val classLoader = TestDatabaseHelper::class.java.classLoader
            val inputStream = classLoader?.getResourceAsStream(resourcePath)
                ?: throw RuntimeException("Schema file not found in resources: $resourcePath. Ensure it's in src/test/resources/$SCHEMAS_RESOURCE_PATH")

            val schemaSql = inputStream.use { stream ->
                InputStreamReader(stream, StandardCharsets.UTF_8).buffered().readText()
            }

            db.beginTransaction()
            try {
                schemaSql.split(";")
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }
                    .forEach { statement ->
                        try {
                            db.execSQL(statement)
                        } catch (e: android.database.SQLException) {
                            throw RuntimeException(
                                "Error executing SQL statement: [$statement] from schema file $schemaFileName",
                                e,
                            )
                        }
                    }
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        } catch (e: Exception) {
            db.close()
            throw RuntimeException("Failed to create database from schema: $resourcePath", e)
        }
        return db
    }

    fun SQLiteDatabase.getCursorToTable(tableName: String): Cursor {
        val sql = "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        val selectionArgs = arrayOf(tableName)
        return this.rawQuery(sql, selectionArgs)
    }

    fun SQLiteDatabase.insertEventBatch(
        batchId: String,
        createdAt: Long,
        eventId: String,
    ) {
        val values = ContentValues().apply {
            put(EventsBatchTable.COL_BATCH_ID, batchId)
            put(EventsBatchTable.COL_CREATED_AT, createdAt)
            put(EventsBatchTable.COL_EVENT_ID, eventId)
        }
        this.insertOrThrow(EventsBatchTable.TABLE_NAME, null, values)
    }

    fun SQLiteDatabase.getBatchesTable(): Cursor = rawQuery("SELECT * FROM batches", null)

    fun SQLiteDatabase.queryTableInfo(tableName: String): Cursor = rawQuery("PRAGMA table_info($tableName)", null)
}
