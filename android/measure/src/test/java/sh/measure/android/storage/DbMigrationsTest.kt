package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.TestDatabaseHelper.getBatchesTable
import sh.measure.android.storage.TestDatabaseHelper.getCursorToTable
import sh.measure.android.storage.TestDatabaseHelper.insertEventBatch
import sh.measure.android.storage.TestDatabaseHelper.queryTableInfo

@RunWith(AndroidJUnit4::class)
@Config(manifest = Config.NONE)
class DbMigrationsTest {
    private val logger = NoopLogger()

    @Test
    fun `migration v1 to v2 creates new app exit table`() {
        val db = TestDatabaseHelper.createDatabase(DbVersion.V1)

        // Perform migration
        DbMigrations.apply(logger, db, DbVersion.V1, DbVersion.V2)

        // Verify migration
        val cursor = db.getCursorToTable("app_exit")
        assertTrue(cursor.moveToFirst())
        cursor.close()
        db.close()
    }

    @Test
    fun `migration v2 to v3 creates new spans and batches tables`() {
        val db = TestDatabaseHelper.createDatabase(DbVersion.V2)

        // Perform migration
        DbMigrations.apply(logger, db, DbVersion.V2, DbVersion.V3)

        // Verify spans table exists
        val spansCursor = db.getCursorToTable("spans")
        assertTrue(spansCursor.moveToFirst())
        spansCursor.close()

        // Check that batches table exists
        val batchesCursor = db.getCursorToTable("batches")
        assertTrue(batchesCursor.moveToFirst())
        batchesCursor.close()

        // Check that spans batch table exists
        val spansBatchCursor = db.getCursorToTable("spans_batch")
        assertTrue(spansBatchCursor.moveToFirst())
        spansBatchCursor.close()

        db.close()
    }

    @Test
    fun `migration v2 to v3 populates batches table from events batch table`() {
        val db = TestDatabaseHelper.createDatabase(DbVersion.V2)
        db.insertEventBatch("batch-1", 1643723400, "event-1-0")
        db.insertEventBatch("batch-2", 1643723410, "event-2-0")
        db.insertEventBatch("batch-2", 1643723420, "event-2-1")
        db.insertEventBatch("batch-2", 1643723430, "event-2-3")

        // Perform migration
        DbMigrations.apply(logger, db, DbVersion.V2, DbVersion.V3)

        // Check that batches table is populated correctly
        val batchesCursor = db.getBatchesTable()
        assertTrue(batchesCursor.moveToFirst())
        assertEquals(2, batchesCursor.count)
        batchesCursor.close()

        db.close()
    }

    @Test
    fun `migration v3 to v4 adds columns to app exit table`() {
        val db = TestDatabaseHelper.createDatabase(DbVersion.V3)

        // Perform migration
        DbMigrations.apply(logger, db, DbVersion.V3, DbVersion.V4)

        // Verify app exit table exists with new columns
        val cursor = db.queryTableInfo("app_exit")
        val columnNames = mutableListOf<String>()
        if (cursor.moveToFirst()) {
            do {
                columnNames.add(cursor.getString(cursor.getColumnIndexOrThrow("name")))
            } while (cursor.moveToNext())
        }
        cursor.close()

        assertTrue(columnNames.contains(AppExitTable.COL_APP_BUILD))
        assertTrue(columnNames.contains(AppExitTable.COL_APP_VERSION))

        db.close()
    }

    @Test
    fun `migration v4 to v5 creates attachments_v1 table and migrates data`() {
        val db = TestDatabaseHelper.createDatabase(DbVersion.V4)

        // Insert test data into old attachments table
        db.execSQL(
            """
        INSERT INTO ${AttachmentTable.TABLE_NAME} (
            ${AttachmentTable.COL_ID},
            ${AttachmentTable.COL_SESSION_ID},
            ${AttachmentTable.COL_EVENT_ID},
            ${AttachmentTable.COL_TYPE},
            ${AttachmentTable.COL_TIMESTAMP},
            ${AttachmentTable.COL_FILE_PATH},
            ${AttachmentTable.COL_NAME}
        ) VALUES (
            'attachment-1',
            'session-1',
            'event-1',
            'screenshot',
            '1643723400',
            '/path/to/file1.png',
            'screenshot1.png'
        )
            """.trimIndent(),
        )

        db.execSQL(
            """
        INSERT INTO ${AttachmentTable.TABLE_NAME} (
            ${AttachmentTable.COL_ID},
            ${AttachmentTable.COL_SESSION_ID},
            ${AttachmentTable.COL_EVENT_ID},
            ${AttachmentTable.COL_TYPE},
            ${AttachmentTable.COL_TIMESTAMP},
            ${AttachmentTable.COL_FILE_PATH},
            ${AttachmentTable.COL_NAME}
        ) VALUES (
            'attachment-2',
            'session-1',
            'event-2',
            'log',
            '1643723410',
            '/path/to/file2.log',
            'log2.log'
        )
            """.trimIndent(),
        )

        // Perform migration
        DbMigrations.apply(logger, db, DbVersion.V4, DbVersion.V5)

        // Verify new table exists with correct schema
        val tableInfoCursor = db.queryTableInfo(AttachmentV1Table.TABLE_NAME)
        val columnNames = mutableListOf<String>()
        if (tableInfoCursor.moveToFirst()) {
            do {
                columnNames.add(tableInfoCursor.getString(tableInfoCursor.getColumnIndexOrThrow("name")))
            } while (tableInfoCursor.moveToNext())
        }
        tableInfoCursor.close()

        // Verify all expected columns exist
        assertTrue(columnNames.contains(AttachmentV1Table.COL_ID))
        assertTrue(columnNames.contains(AttachmentV1Table.COL_SESSION_ID))
        assertTrue(columnNames.contains(AttachmentV1Table.COL_EVENT_ID))
        assertTrue(columnNames.contains(AttachmentV1Table.COL_TYPE))
        assertTrue(columnNames.contains(AttachmentV1Table.COL_TIMESTAMP))
        assertTrue(columnNames.contains(AttachmentV1Table.COL_FILE_PATH))
        assertTrue(columnNames.contains(AttachmentV1Table.COL_NAME))
        assertTrue(columnNames.contains(AttachmentV1Table.COL_UPLOAD_URL))
        assertTrue(columnNames.contains(AttachmentV1Table.COL_URL_EXPIRES_AT))

        // Verify data was migrated correctly
        val dataCursor = db.rawQuery(
            "SELECT * FROM ${AttachmentV1Table.TABLE_NAME} ORDER BY ${AttachmentV1Table.COL_ID}",
            null,
        )
        assertTrue(dataCursor.moveToFirst())
        assertEquals(2, dataCursor.count)

        // Verify first row
        assertEquals(
            "attachment-1",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_ID)),
        )
        assertEquals(
            "session-1",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_SESSION_ID)),
        )
        assertEquals(
            "event-1",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_EVENT_ID)),
        )
        assertEquals(
            "screenshot",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_TYPE)),
        )
        assertEquals(
            "1643723400",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_TIMESTAMP)),
        )
        assertEquals(
            "/path/to/file1.png",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_FILE_PATH)),
        )
        assertEquals(
            "screenshot1.png",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_NAME)),
        )

        // Verify second row
        assertTrue(dataCursor.moveToNext())
        assertEquals(
            "attachment-2",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_ID)),
        )
        assertEquals(
            "session-1",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_SESSION_ID)),
        )
        assertEquals(
            "event-2",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_EVENT_ID)),
        )
        assertEquals(
            "log",
            dataCursor.getString(dataCursor.getColumnIndexOrThrow(AttachmentV1Table.COL_TYPE)),
        )

        dataCursor.close()

        // Verify old table no longer exists
        val tablesCursor = db.rawQuery(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='${AttachmentTable.TABLE_NAME}'",
            null,
        )
        assertEquals(0, tablesCursor.count)
        tablesCursor.close()

        db.close()
    }

    @Test
    fun `migration v4 to v5 handles empty attachments table`() {
        val db = TestDatabaseHelper.createDatabase(DbVersion.V4)

        // Perform migration without any data
        DbMigrations.apply(logger, db, DbVersion.V4, DbVersion.V5)

        // Verify new table exists but is empty
        val dataCursor = db.rawQuery("SELECT * FROM ${AttachmentV1Table.TABLE_NAME}", null)
        assertEquals(0, dataCursor.count)
        dataCursor.close()

        // Verify old table no longer exists
        val tablesCursor = db.rawQuery(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='${AttachmentTable.TABLE_NAME}'",
            null,
        )
        assertEquals(0, tablesCursor.count)
        tablesCursor.close()

        db.close()
    }
}
