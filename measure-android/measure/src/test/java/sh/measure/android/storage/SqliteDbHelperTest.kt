package sh.measure.android.storage

import android.os.Build.VERSION_CODES.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.SessionDbConstants.SessionTable

@RunWith(AndroidJUnit4::class)
internal class SqliteDbHelperTest {
    private lateinit var db: SqliteDbHelper
    private val logger = NoopLogger()

    @Before
    fun setup() {
        val context = RuntimeEnvironment.getApplication()
        db = SqliteDbHelper(logger, context)
    }

    @After
    fun teardown() {
        db.close()
    }

    @Test
    fun `SqliteDbHelper creates sessions table in DB on initialization`() {
        db.writableDatabase.use {
            it.rawQuery("SELECT name FROM sqlite_master WHERE type='table'", null).use { cursor ->
                assertTrue(cursor.moveToFirst())
                assertTrue(cursor.moveToNext())
                assertEquals(SessionTable.TABLE_NAME, cursor.getString(0))
                // assert no other tables are created
                assertFalse(cursor.moveToNext())
            }
        }
    }
}