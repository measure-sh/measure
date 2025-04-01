package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.TestDatabaseHelper.getBatchesTable
import sh.measure.android.storage.TestDatabaseHelper.insertEventBatch
import sh.measure.android.storage.TestDatabaseHelper.queryTableExists

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
        val cursor = db.queryTableExists("app_exit")
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
        val spansCursor = db.queryTableExists("spans")
        assertTrue(spansCursor.moveToFirst())
        spansCursor.close()

        // Check that batches table exists
        val batchesCursor = db.queryTableExists("batches")
        assertTrue(batchesCursor.moveToFirst())
        batchesCursor.close()

        // Check that spans batch table exists
        val spansBatchCursor = db.queryTableExists("spans_batch")
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
}
