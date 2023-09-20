package sh.measure.android.storage

import android.os.Build.VERSION_CODES.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import sh.measure.android.storage.SessionContract.SignalsTable
import sh.measure.android.storage.SessionContract.SessionTable
import sh.measure.android.fakes.NoopLogger

@RunWith(AndroidJUnit4::class)
internal class SqliteDbHelperTest {
    private lateinit var dbClient: SqliteDbHelper
    private val logger = NoopLogger()

    @Before
    fun setup() {
        val context = RuntimeEnvironment.getApplication()
        dbClient = SqliteDbHelper(logger, context)
    }

    @After
    fun teardown() {
        dbClient.close()
    }

    @Test
    fun `database contains session and session_data tables on initialization`() {
        dbClient.writableDatabase.use {
            it.rawQuery("SELECT name FROM sqlite_master WHERE type='table'", null).use { cursor ->
                assertTrue(cursor.moveToFirst())
                assertTrue(cursor.moveToNext())
                assertEquals(SessionTable.TABLE_NAME, cursor.getString(0))
                assertTrue(cursor.moveToNext())
                assertEquals(SignalsTable.TABLE_NAME, cursor.getString(0))
                assertFalse(cursor.moveToNext())
            }
        }
    }
}