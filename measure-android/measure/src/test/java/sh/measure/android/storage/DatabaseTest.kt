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
            it.moveToNext()
            assertEquals(EventsBatchTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
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

    @Test
    fun `inserts batched events successfully`() {
        val event1 = EventEntity(
            id = "event-id-1",
            type = "test",
            timestamp = 1234567890L,
            sessionId = "987",
            filePath = "test-file-path",
            attachmentEntities = emptyList(),
            serializedAttributes = null,
            attachmentsSize = 500,
        )

        val event2 = EventEntity(
            id = "event-id-2",
            type = "test",
            timestamp = 1234567899L,
            sessionId = "987",
            filePath = "test-file-path",
            attachmentEntities = emptyList(),
            serializedAttributes = null,
            attachmentsSize = 200,
        )

        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertBatchedEventIds(listOf(event1.id, event2.id), "batch-id")

        queryAllBatchedEvents().use {
            assertEquals(2, it.count)
            it.moveToFirst()
            assertBatchedEventInCursor(event1.id, "batch-id", it)
            it.moveToNext()
            assertBatchedEventInCursor(event2.id, "batch-id", it)
        }
    }

    @Test
    fun `returns event IDs to batch along with total attachments size`() {
        val event1 = EventEntity(
            id = "event-id-1",
            type = "test",
            timestamp = 1234567890L,
            sessionId = "987",
            filePath = "test-file-path",
            attachmentEntities = emptyList(),
            serializedAttributes = null,
            attachmentsSize = 500,
        )

        val event2 = EventEntity(
            id = "event-id-2",
            type = "test",
            timestamp = 1234567899L,
            sessionId = "987",
            filePath = "test-file-path",
            attachmentEntities = emptyList(),
            serializedAttributes = null,
            attachmentsSize = 200,
        )

        database.insertEvent(event1)
        database.insertEvent(event2)

        val eventsToBatch = database.getEventsToBatch(2)
        assertEquals(2, eventsToBatch.eventIdAttachmentSizeMap.size)
        assertEquals(700, eventsToBatch.totalAttachmentsSize)
    }

    @Test
    fun `returns event IDs to batch along with total attachment size, but discards already batched events`() {
        val event1 = EventEntity(
            id = "event-id-1",
            type = "test",
            timestamp = 1234567890L,
            sessionId = "987",
            filePath = "test-file-path",
            attachmentEntities = emptyList(),
            serializedAttributes = null,
            attachmentsSize = 500,
        )

        val event2 = EventEntity(
            id = "event-id-2",
            type = "test",
            timestamp = 1234567899L,
            sessionId = "987",
            filePath = "test-file-path",
            attachmentEntities = emptyList(),
            serializedAttributes = null,
            attachmentsSize = 200,
        )

        val batchedEvent = EventEntity(
            id = "event-id-3",
            type = "test",
            timestamp = 1234567899L,
            sessionId = "987",
            filePath = "test-file-path",
            attachmentEntities = emptyList(),
            serializedAttributes = null,
            attachmentsSize = 200,
        )

        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertEvent(batchedEvent)
        database.insertBatchedEventIds(listOf(batchedEvent.id), "batch-id")

        val eventsToBatch = database.getEventsToBatch(2)
        assertEquals(2, eventsToBatch.eventIdAttachmentSizeMap.size)
        assertEquals(700, eventsToBatch.totalAttachmentsSize)
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

    private fun queryAllBatchedEvents(): Cursor {
        val db = database.writableDatabase
        return db.query(
            EventsBatchTable.TABLE_NAME,
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
            attachmentEntity.extension,
            cursor.getString(cursor.getColumnIndex(AttachmentTable.COL_EXTENSION)),
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

    private fun assertBatchedEventInCursor(
        eventId: String,
        @Suppress("SameParameterValue") batchId: String,
        cursor: Cursor,
    ) {
        assertEquals(
            eventId,
            cursor.getString(cursor.getColumnIndex(EventsBatchTable.COL_EVENT_ID)),
        )
        assertEquals(
            batchId,
            cursor.getString(cursor.getColumnIndex(EventsBatchTable.COL_BATCH_ID)),
        )
    }
}
