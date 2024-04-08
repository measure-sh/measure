package sh.measure.android.storage

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import sh.measure.android.fakes.NoopLogger

/**
 * A robolectric integration test for the database implementation. This test creates a real
 * sqlite database.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [Config.OLDEST_SDK])
class DatabaseTest {
    private val database =
        DatabaseImpl(InstrumentationRegistry.getInstrumentation().context, NoopLogger())

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun `database is created successfully`() {
        val db = database.writableDatabase

        // Sqlite master table contains metadata about all tables in the database
        // with the name of the table in the 'name' column

        // verify events table has been created
        db.query("sqlite_master", null, "type = ?", arrayOf("table"), null, null, null).use {
            it.moveToFirst()
            // first table is android_metadata, skip it.
            it.moveToNext()
            assertEquals(EventTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
        }
    }

    @Test
    fun `inserts event successfully`() {
        val eventEntity = EventEntity(
            id = "event-id",
            type = "test",
            timestamp = 1234567890L,
            sessionId = "987",
            serializedData = "test-data"
        )

        // When
        database.insertEvent(eventEntity)

        // Then
        val db = database.writableDatabase
        queryAllEvents(db).use {
            assertEquals(1, it.count)
            it.moveToFirst()
            assertEventInCursor(eventEntity, it)
        }
    }

    /**
     * Asserts that the event in the cursor matches the expected event.
     *
     * @param expectedEvent The expected event.
     * @param cursor The cursor to assert.
     */
    private fun assertEventInCursor(expectedEvent: EventEntity, cursor: Cursor) {
        assertEquals(expectedEvent.id, cursor.getString(cursor.getColumnIndex(EventTable.COL_ID)))
        assertEquals(
            expectedEvent.type, cursor.getString(cursor.getColumnIndex(EventTable.COL_TYPE))
        )
        assertEquals(
            expectedEvent.timestamp, cursor.getLong(cursor.getColumnIndex(EventTable.COL_TIMESTAMP))
        )
        assertEquals(
            expectedEvent.sessionId,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_SESSION_ID))
        )
        assertEquals(
            expectedEvent.serializedData,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_DATA_SERIALIZED))
        )
        assertEquals(
            expectedEvent.filePath,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_DATA_FILE_PATH))
        )
    }

    private fun queryAllEvents(db: SQLiteDatabase): Cursor {
        return db.query(
            EventTable.TABLE_NAME, null, null, null, null, null, null
        )
    }
}