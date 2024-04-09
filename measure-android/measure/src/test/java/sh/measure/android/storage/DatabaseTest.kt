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
            it.moveToNext()
            assertEquals(AttachmentTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
        }
    }

    @Test
    fun `inserts event with attachments successfully`() {
        val db = database.writableDatabase

        val attachmentEntity = AttachmentEntity(
            id = "attachment-id",
            type = "test",
            extension = "txt",
            path = "test-path",
        )
        val event = EventEntity(
            id = "event-id",
            type = "test",
            timestamp = 1234567890L,
            sessionId = "987",
            filePath = "test-file-path",
            attachmentEntities = listOf(attachmentEntity),
            serializedAttributes = null,
            attachmentsSize = 0,
        )

        database.insertEvent(event)

        queryAllEvents(db).use {
            it.moveToFirst()
            assertEventInCursor(event, it)
        }
        queryAttachmentsForEvent(db, event.id).use {
            it.moveToFirst()
            assertAttachmentInCursor(attachmentEntity, event, it)
        }
    }

    @Test
    fun `inserts event without attachments successfully`() {
        val db = database.writableDatabase

        val event = EventEntity(
            id = "event-id",
            type = "test",
            timestamp = 1234567890L,
            sessionId = "987",
            filePath = "test-file-path",
            attachmentEntities = emptyList(),
            serializedAttributes = null,
            attachmentsSize = 500,
        )

        database.insertEvent(event)

        queryAllEvents(db).use {
            it.moveToFirst()
            assertEventInCursor(event, it)
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
            expectedEvent.type,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_TYPE)),
        )
        assertEquals(
            expectedEvent.timestamp,
            cursor.getLong(cursor.getColumnIndex(EventTable.COL_TIMESTAMP)),
        )
        assertEquals(
            expectedEvent.sessionId,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_SESSION_ID)),
        )
        assertEquals(
            expectedEvent.serializedData,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_DATA_SERIALIZED)),
        )
        assertEquals(
            expectedEvent.filePath,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_DATA_FILE_PATH)),
        )
        assertEquals(
            expectedEvent.serializedAttributes,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_ATTRIBUTES)),
        )
        assertEquals(
            expectedEvent.attachmentsSize,
            cursor.getLong(cursor.getColumnIndex(EventTable.COL_ATTACHMENT_SIZE)),
        )
    }

    private fun assertAttachmentInCursor(
        attachmentEntity: AttachmentEntity,
        event: EventEntity,
        cursor: Cursor,
    ) {
        assertEquals(
            attachmentEntity.id,
            cursor.getString(cursor.getColumnIndex(AttachmentTable.COL_ID)),
        )
        assertEquals(
            attachmentEntity.type,
            cursor.getString(cursor.getColumnIndex(AttachmentTable.COL_TYPE)),
        )
        assertEquals(
            attachmentEntity.path,
            cursor.getString(cursor.getColumnIndex(AttachmentTable.COL_FILE_PATH)),
        )
        assertEquals(
            event.timestamp,
            cursor.getLong(cursor.getColumnIndex(AttachmentTable.COL_TIMESTAMP)),
        )
        assertEquals(
            event.sessionId,
            cursor.getString(cursor.getColumnIndex(AttachmentTable.COL_SESSION_ID)),
        )
        assertEquals(
            event.id,
            cursor.getString(cursor.getColumnIndex(AttachmentTable.COL_EVENT_ID)),
        )
    }

    private fun queryAllEvents(db: SQLiteDatabase): Cursor {
        return db.query(
            EventTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        )
    }

    private fun queryAttachmentsForEvent(db: SQLiteDatabase, eventId: String): Cursor {
        return db.query(
            AttachmentTable.TABLE_NAME,
            null,
            "${AttachmentTable.COL_EVENT_ID} = ?",
            arrayOf(eventId),
            null,
            null,
            null,
        )
    }
}
