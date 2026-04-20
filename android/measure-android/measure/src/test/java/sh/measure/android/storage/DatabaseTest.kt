package sh.measure.android.storage

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import sh.measure.android.config.DefaultConfig
import sh.measure.android.events.EventType
import sh.measure.android.exporter.EventPacket
import sh.measure.android.exporter.SignedAttachment
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock

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
        db.query("sqlite_master", null, "type = ?", arrayOf("table"), null, null, null).use {
            it.moveToFirst()
            // first table is android_metadata, skip it.
            it.moveToNext()
            assertEquals(SessionsTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(EventTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(AttachmentV1Table.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(BatchesTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(EventsBatchTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(AppExitTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(SpansTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(SpansBatchTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
        }
    }

    @Test
    fun `insertEvent returns true when event with attachments is successfully inserted`() {
        // given
        val attachmentEntity = TestData.getAttachmentEntity()
        val eventWithAttachment = TestData.getEventEntity(
            sessionId = "session-id-1",
            attachmentEntities = listOf(attachmentEntity),
        )
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))

        // when
        val result = database.insertEvent(eventWithAttachment)

        // then
        assertTrue(result)

        val db = database.readableDatabase
        queryAllEvents(db).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEventInCursor(eventWithAttachment, cursor)
        }
        queryAttachmentsForEvent(db, eventWithAttachment.id).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertAttachmentInCursor(attachmentEntity, eventWithAttachment, cursor)
        }
    }

    @Test
    fun `insertEvent returns true when event without attachment is successfully inserted`() {
        // given
        val event = TestData.getEventEntity(
            sessionId = "session-id-1",
            attachmentEntities = emptyList(),
        )
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))

        // when
        val result = database.insertEvent(event)

        // then
        assertTrue(result)

        val db = database.readableDatabase
        queryAllEvents(db).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEventInCursor(event, cursor)
        }
        queryAttachmentsForEvent(db, event.id).use { cursor ->
            assertEquals(0, cursor.count)
        }
    }

    @Test
    fun `insertEvent returns false when event insertion fails`() {
        // given
        val event = TestData.getEventEntity(sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))

        // insert first event successfully
        val firstResult = database.insertEvent(event)
        assertTrue(firstResult)

        // when - attempt to insert an event with same ID twice, resulting in a failure
        val result = database.insertEvent(event)

        // then
        assertFalse(result)
        queryAllEvents(database.readableDatabase).use { cursor ->
            assertEquals(1, cursor.count)
        }
    }

    @Test
    fun `insertEvent returns false when event insertion fails due to attachment insertion failure`() {
        // given
        // attempt inserting attachment with same ID twice, resulting in a failure
        val event = TestData.getEventEntity(
            sessionId = "session-id-1",
            attachmentEntities = listOf(
                TestData.getAttachmentEntity(id = "attachment-id-1"),
                TestData.getAttachmentEntity(id = "attachment-id-1"),
            ),
        )
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))

        // when
        val result = database.insertEvent(event)

        // then
        assertFalse(result)

        val db = database.readableDatabase
        queryAllEvents(db).use { cursor ->
            assertEquals(0, cursor.count)
        }
        db.query(AttachmentV1Table.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
    }

    @Test
    fun `insertBatch successfully inserts batch with events and spans to batches tables`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-1")
        val span1 = TestData.getSpanEntity(spanId = "span-id-1", sessionId = "session-id-1")
        val span2 = TestData.getSpanEntity(spanId = "span-id-2", sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertSpan(span1)
        database.insertSpan(span2)

        // when
        val result = database.insertBatch(
            BatchEntity(
                batchId = "batch-id",
                eventIds = setOf(event1.id, event2.id),
                spanIds = setOf(span1.spanId, span2.spanId),
                createdAt = 1234567890L,
            ),
        )

        // then
        assertTrue(result)

        val db = database.readableDatabase

        // verify batch was inserted
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "batch-id",
                cursor.getString(cursor.getColumnIndex(BatchesTable.COL_BATCH_ID)),
            )
            assertEquals(
                1234567890L,
                cursor.getLong(cursor.getColumnIndex(BatchesTable.COL_CREATED_AT)),
            )
        }

        // verify event batches were inserted
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(2, cursor.count)
            val eventIds = mutableSetOf<String>()
            while (cursor.moveToNext()) {
                assertEquals(
                    "batch-id",
                    cursor.getString(cursor.getColumnIndex(EventsBatchTable.COL_BATCH_ID)),
                )
                eventIds.add(cursor.getString(cursor.getColumnIndex(EventsBatchTable.COL_EVENT_ID)))
            }
            assertEquals(setOf("event-id-1", "event-id-2"), eventIds)
        }

        // verify span batches were inserted
        db.query(SpansBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(2, cursor.count)
            val spanIds = mutableSetOf<String>()
            while (cursor.moveToNext()) {
                assertEquals(
                    "batch-id",
                    cursor.getString(cursor.getColumnIndex(SpansBatchTable.COL_BATCH_ID)),
                )
                spanIds.add(cursor.getString(cursor.getColumnIndex(SpansBatchTable.COL_SPAN_ID)))
            }
            assertEquals(setOf("span-id-1", "span-id-2"), spanIds)
        }
    }

    @Test
    fun `insertBatch returns false when event batch insertion fails`() {
        // given
        // attempt to insert an event with same ID twice, resulting in a failure
        val batchEntity = BatchEntity(
            batchId = "batch-id",
            eventIds = setOf("valid-id", "event-id", "event-id"),
            spanIds = emptySet(),
            createdAt = 987654321L,
        )

        // when
        val result = database.insertBatch(batchEntity)

        // then
        assertFalse(result)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        db.query(SpansBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
    }

    @Test
    fun `insertBatch returns false when span batch insertion fails`() {
        // given
        // attempt to insert a span with same ID twice, resulting in a failure
        val batchEntity = BatchEntity(
            batchId = "batch-id",
            eventIds = emptySet(),
            spanIds = setOf("valid-id", "span-id", "span-id"),
            createdAt = 987654321L,
        )

        // when
        val result = database.insertBatch(batchEntity)

        // then
        assertFalse(result)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        db.query(SpansBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
    }

    @Test
    fun `insertBatch returns false when insertion fails due to event ID not present in events table`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val eventNotInEventsTable =
            TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertEvent(event1)

        // when
        val result = database.insertBatch(
            BatchEntity(
                batchId = "batch-id",
                eventIds = setOf(event1.id, eventNotInEventsTable.id),
                spanIds = emptySet(),
                createdAt = 1234567890L,
            ),
        )

        // then
        assertFalse(result)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        db.query(SpansBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        // verify original event still exists
        queryAllEvents(db).use { cursor ->
            assertEquals(1, cursor.count)
        }
    }

    @Test
    fun `insertBatch returns false when insertion fails due to span ID not present in spans table`() {
        // given
        val span1 = TestData.getSpanEntity(spanId = "span-id-1", sessionId = "session-id-1")
        val spanNotInSpansTable =
            TestData.getSpanEntity(spanId = "span-id-2", sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertSpan(span1)

        // when
        val result = database.insertBatch(
            BatchEntity(
                batchId = "batch-id",
                eventIds = emptySet(),
                spanIds = setOf(span1.spanId, spanNotInSpansTable.spanId),
                createdAt = 1234567890L,
            ),
        )

        // then
        assertFalse(result)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        db.query(SpansBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
        // verify original span still exists
        queryAllSpans(db).use { cursor ->
            assertEquals(1, cursor.count)
        }
    }

    @Test
    fun `batchSessions returns zero when no sessions exist`() {
        val idProvider = FakeIdProvider()
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(0, batchesCreated)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
    }

    @Test
    fun `batchSessions returns zero when sessions exist but no sampled signals`() {
        val idProvider = FakeIdProvider()
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        // event not sampled
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-1",
                sessionId = "session-id-1",
                isSampled = false,
            ),
        )
        // span without sampled flag
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-1",
                sessionId = "session-id-1",
                isSampled = false,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(0, batchesCreated)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(0, cursor.count)
        }
    }

    @Test
    fun `batchSessions batches sampled events`() {
        val idProvider = FakeIdProvider()
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-2",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(1, batchesCreated)

        val db = database.readableDatabase
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(2, cursor.count)
            val eventIds = mutableSetOf<String>()
            while (cursor.moveToNext()) {
                eventIds.add(cursor.getString(cursor.getColumnIndex(EventsBatchTable.COL_EVENT_ID)))
            }
            assertEquals(setOf("event-id-1", "event-id-2"), eventIds)
        }
    }

    @Test
    fun `batchSessions excludes events not sampled`() {
        val idProvider = FakeIdProvider()
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-2",
                sessionId = "session-id-1",
                isSampled = false,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-3",
                sessionId = "session-id-1",
                isSampled = false,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(1, batchesCreated)

        val db = database.readableDatabase
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "event-id-1",
                cursor.getString(cursor.getColumnIndex(EventsBatchTable.COL_EVENT_ID)),
            )
        }
    }

    @Test
    fun `batchSessions excludes already batched events`() {
        val idProvider = FakeIdProvider()
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-2",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        // already batch event-id-2
        database.insertBatch(
            BatchEntity(
                batchId = "existing-batch-id",
                eventIds = setOf("event-id-2"),
                spanIds = emptySet(),
                createdAt = 1234567890L,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(1, batchesCreated)

        val db = database.readableDatabase
        // verify only event-id-1 is in the new batch
        db.query(
            EventsBatchTable.TABLE_NAME,
            null,
            "${EventsBatchTable.COL_BATCH_ID} != ?",
            arrayOf("existing-batch-id"),
            null,
            null,
            null,
        ).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "event-id-1",
                cursor.getString(cursor.getColumnIndex(EventsBatchTable.COL_EVENT_ID)),
            )
        }
    }

    @Test
    fun `batchSessions batches spans with sampled flag set`() {
        val idProvider = FakeIdProvider()
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-2",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(1, batchesCreated)

        val db = database.readableDatabase
        db.query(SpansBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(2, cursor.count)
            val spanIds = mutableSetOf<String>()
            while (cursor.moveToNext()) {
                spanIds.add(cursor.getString(cursor.getColumnIndex(SpansBatchTable.COL_SPAN_ID)))
            }
            assertEquals(setOf("span-id-1", "span-id-2"), spanIds)
        }
    }

    @Test
    fun `batchSessions excludes spans without sampled flag`() {
        val idProvider = FakeIdProvider()
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-2",
                sessionId = "session-id-1",
                isSampled = false,
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-3",
                sessionId = "session-id-1",
                isSampled = false,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(1, batchesCreated)

        val db = database.readableDatabase
        db.query(SpansBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "span-id-1",
                cursor.getString(cursor.getColumnIndex(SpansBatchTable.COL_SPAN_ID)),
            )
        }
    }

    @Test
    fun `batchSessions excludes already batched sampled spans`() {
        val idProvider = FakeIdProvider()
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-2",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        // already batch span-id-2
        database.insertBatch(
            BatchEntity(
                batchId = "existing-batch-id",
                eventIds = emptySet(),
                spanIds = setOf("span-id-2"),
                createdAt = 1234567890L,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(1, batchesCreated)

        val db = database.readableDatabase
        // verify only span-id-1 is in the new batch
        db.query(
            SpansBatchTable.TABLE_NAME,
            null,
            "${SpansBatchTable.COL_BATCH_ID} != ?",
            arrayOf("existing-batch-id"),
            null,
            null,
            null,
        ).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "span-id-1",
                cursor.getString(cursor.getColumnIndex(SpansBatchTable.COL_SPAN_ID)),
            )
        }
    }

    @Test
    fun `batchSessions creates multiple batches when signals exceed maxBatchSize`() {
        val idProvider = FakeIdProvider(autoIncrement = true)
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        // insert 5 sampled events that
        for (i in 1..5) {
            database.insertEvent(
                TestData.getEventEntity(
                    eventId = "event-id-$i",
                    sessionId = "session-id-1",
                    isSampled = true,
                ),
            )
        }

        // when - maxBatchSize of 2 should create 3 batches (2, 2, 1)
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 2,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(3, batchesCreated)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(3, cursor.count)
        }
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(5, cursor.count)
        }
    }

    @Test
    fun `batchSessions combines events and spans in same batch`() {
        val idProvider = FakeIdProvider()
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-2",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-id-2",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(1, batchesCreated)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(1, cursor.count)
        }
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(2, cursor.count)
        }
        db.query(SpansBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(2, cursor.count)
        }
    }

    @Test
    fun `batchSessions flushes to database when insertionBatchSize is reached`() {
        val idProvider = FakeIdProvider(autoIncrement = false)
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        // insert 10 sampled events
        for (i in 1..10) {
            database.insertEvent(
                TestData.getEventEntity(
                    eventId = "event-id-$i",
                    sessionId = "session-id-1",
                    isSampled = true,
                ),
            )
        }

        // when - insertionBatchSize of 3 triggers flushes at 3, 6, 9, and 10 events
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 3,
        )

        // then - 4 flush operations, but all events go into 1 batch
        assertEquals(4, batchesCreated)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(1, cursor.count)
        }
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(10, cursor.count)
        }
    }

    @Test
    fun `batchSessions processes multiple sessions in single batch`() {
        val idProvider = FakeIdProvider(autoIncrement = true)
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-2",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-2",
                sessionId = "session-id-2",
                isSampled = true,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then - each session gets its own batch
        assertEquals(1, batchesCreated)

        val db = database.readableDatabase
        db.query(BatchesTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(1, cursor.count)
        }
        db.query(EventsBatchTable.TABLE_NAME, null, null, null, null, null, null).use { cursor ->
            assertEquals(2, cursor.count)
        }
    }

    @Test
    fun `batchSessions processes priority sessions first`() {
        val idProvider = FakeIdProvider(autoIncrement = true)
        val timeProvider = AndroidTimeProvider(TestClock.create())

        // given - insert non-priority session first, then priority session
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                prioritySession = false,
                trackJourney = false,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-2",
                prioritySession = true, // priority session
                trackJourney = false,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-1",
                sessionId = "session-id-1",
                isSampled = true,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-2",
                sessionId = "session-id-2",
                isSampled = true,
            ),
        )

        // when
        val batchesCreated = database.batchSessions(
            idProvider = idProvider,
            timeProvider = timeProvider,
            maxBatchSize = 100,
            insertionBatchSize = 100,
        )

        // then
        assertEquals(1, batchesCreated)

        val db = database.readableDatabase
        // get batches ordered by created_at to verify processing order
        db.query(
            BatchesTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            "${BatchesTable.COL_CREATED_AT} ASC",
        ).use { cursor ->
            assertEquals(1, cursor.count)

            // get batch ID
            assertTrue(cursor.moveToFirst())
            val firstBatchId = cursor.getString(cursor.getColumnIndex(BatchesTable.COL_BATCH_ID))

            // verify batch contains event from priority session
            db.query(
                EventsBatchTable.TABLE_NAME,
                null,
                "${EventsBatchTable.COL_BATCH_ID} = ?",
                arrayOf(firstBatchId),
                null,
                null,
                null,
            ).use { eventCursor ->
                assertTrue(eventCursor.moveToFirst())
                assertEquals(
                    "event-id-2",
                    eventCursor.getString(eventCursor.getColumnIndex(EventsBatchTable.COL_EVENT_ID)),
                )
            }
        }
    }

    @Test
    fun `getBatchIds returns all available batches in ascending order of creation`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertEvent(
            TestData.getEventEntity(eventId = "event-1", sessionId = "session-id"),
        )
        database.insertEvent(
            TestData.getEventEntity(eventId = "event-2", sessionId = "session-id"),
        )
        database.insertEvent(
            TestData.getEventEntity(eventId = "event-3", sessionId = "session-id"),
        )

        // Insert batches with different creation times (out of order)
        database.insertBatch(
            BatchEntity(
                batchId = "batch-1",
                createdAt = 1000L,
                eventIds = setOf("event-1"),
                spanIds = emptySet(),
            ),
        )
        database.insertBatch(
            BatchEntity(
                batchId = "batch-2",
                createdAt = 3000L,
                eventIds = setOf("event-2"),
                spanIds = emptySet(),
            ),
        )
        database.insertBatch(
            BatchEntity(
                batchId = "batch-3",
                createdAt = 2000L,
                eventIds = setOf("event-3"),
                spanIds = emptySet(),
            ),
        )

        // when
        val result = database.getBatchIds()

        // then
        assertEquals(3, result.size)
        assertEquals("batch-1", result[0])
        assertEquals("batch-3", result[1])
        assertEquals("batch-2", result[2])
    }

    @Test
    fun `getBatch returns a batch by ID`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertSession(TestData.getSessionEntity(id = "session-id-2"))
        database.insertEvent(
            TestData.getEventEntity(eventId = "event-1", sessionId = "session-id"),
        )
        database.insertEvent(
            TestData.getEventEntity(eventId = "event-2", sessionId = "session-id"),
        )
        database.insertSpan(
            TestData.getSpanEntity(spanId = "span-1", sessionId = "session-id"),
        )
        database.insertSpan(
            TestData.getSpanEntity(spanId = "span-2", sessionId = "session-id-2"),
        )
        database.insertBatch(
            BatchEntity(
                batchId = "batch-id",
                createdAt = 1000L,
                eventIds = setOf("event-1", "event-2"),
                spanIds = setOf("span-1", "span-2"),
            ),
        )

        // when
        val result = database.getBatch("batch-id")

        // then
        assertNotNull(result)
        assertEquals("batch-id", result.batchId)
        assertEquals(2, result.eventIds.size)
        assertEquals(2, result.spanIds.size)
    }

    @Test
    fun `deleteSession removes session and cascades to events spans and attachments`() {
        // given
        val sessionToDelete = TestData.getSessionEntity(id = "session-to-delete")
        val sessionToKeep = TestData.getSessionEntity(id = "session-to-keep")
        database.insertSession(sessionToDelete)
        database.insertSession(sessionToKeep)

        // events and attachments for session to delete
        val attachmentToDelete = TestData.getAttachmentEntity(id = "attachment-to-delete")
        val eventToDelete = TestData.getEventEntity(
            eventId = "event-to-delete",
            sessionId = "session-to-delete",
            attachmentEntities = listOf(attachmentToDelete),
        )
        database.insertEvent(eventToDelete)

        // span for session to delete
        val spanToDelete = TestData.getSpanEntity(
            spanId = "span-to-delete",
            sessionId = "session-to-delete",
        )
        database.insertSpan(spanToDelete)

        // events and attachments for session to keep
        val attachmentToKeep = TestData.getAttachmentEntity(id = "attachment-to-keep")
        val eventToKeep = TestData.getEventEntity(
            eventId = "event-to-keep",
            sessionId = "session-to-keep",
            attachmentEntities = listOf(attachmentToKeep),
        )
        database.insertEvent(eventToKeep)

        // span for session to keep
        val spanToKeep = TestData.getSpanEntity(
            spanId = "span-to-keep",
            sessionId = "session-to-keep",
        )
        database.insertSpan(spanToKeep)

        // when
        val result = database.deleteSession("session-to-delete")

        // then
        assertTrue(result)

        val db = database.readableDatabase

        // verify events cascaded
        queryAllEvents(db).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "event-to-keep",
                cursor.getString(cursor.getColumnIndex(EventTable.COL_ID)),
            )
        }

        // verify spans cascaded
        queryAllSpans(db).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "span-to-keep",
                cursor.getString(cursor.getColumnIndex(SpansTable.COL_SPAN_ID)),
            )
        }

        // verify attachments cascaded
        db.query(
            AttachmentV1Table.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "attachment-to-keep",
                cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_ID)),
            )
        }
    }

    @Test
    fun `getSessionIds returns all sessions except excluded one`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-2"))
        database.insertSession(TestData.getSessionEntity(id = "session-3"))

        // when
        val sessionIds = database.getSessionIds(excludeSessionId = "session-2")

        // then
        assertEquals(2, sessionIds.size)
        assertTrue(sessionIds.contains("session-1"))
        assertTrue(sessionIds.contains("session-3"))
        assertFalse(sessionIds.contains("session-2"))
    }

    @Test
    fun `getOldestSession returns null when no sessions exist`() {
        // when
        val sessionId = database.getOldestSession()

        // then
        assertNull(sessionId)
    }

    @Test
    fun `sampleJourneyEvents updates sampled flag for existing journey events`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-1"))

        val activityLifecycleEvent = TestData.getEventEntity(
            eventId = "event-1",
            sessionId = "session-1",
            type = EventType.LIFECYCLE_ACTIVITY,
            isSampled = false,
        )
        val fragmentLifecycleEvent = TestData.getEventEntity(
            eventId = "event-2",
            sessionId = "session-1",
            type = EventType.LIFECYCLE_FRAGMENT,
            isSampled = false,
        )
        val screenViewEvent = TestData.getEventEntity(
            eventId = "event-3",
            sessionId = "session-1",
            type = EventType.SCREEN_VIEW,
            isSampled = false,
        )
        val nonJourneyEvent = TestData.getEventEntity(
            eventId = "event-4",
            sessionId = "session-1",
            type = EventType.LIFECYCLE_APP,
            isSampled = false,
        )

        database.insertEvent(activityLifecycleEvent)
        database.insertEvent(fragmentLifecycleEvent)
        database.insertEvent(screenViewEvent)
        database.insertEvent(nonJourneyEvent)

        // when
        database.sampleJourneyEvents("session-1", DefaultConfig.JOURNEY_EVENTS)

        // then
        val db = database.readableDatabase
        queryAllEvents(db).use { cursor ->
            assertEquals(4, cursor.count)
            while (cursor.moveToNext()) {
                if (cursor.getString(cursor.getColumnIndex(EventTable.COL_ID)) == activityLifecycleEvent.id) {
                    assertTrue(cursor.getInt(cursor.getColumnIndex(EventTable.COL_SAMPLED)) == 1)
                }
                if (cursor.getString(cursor.getColumnIndex(EventTable.COL_ID)) == fragmentLifecycleEvent.id) {
                    assertTrue(cursor.getInt(cursor.getColumnIndex(EventTable.COL_SAMPLED)) == 1)
                }
                if (cursor.getString(cursor.getColumnIndex(EventTable.COL_ID)) == screenViewEvent.id) {
                    assertTrue(cursor.getInt(cursor.getColumnIndex(EventTable.COL_SAMPLED)) == 1)
                }
                if (cursor.getString(cursor.getColumnIndex(EventTable.COL_ID)) == nonJourneyEvent.id) {
                    assertTrue(cursor.getInt(cursor.getColumnIndex(EventTable.COL_SAMPLED)) == 0)
                }
            }
        }
    }

    @Test
    fun `getEventPackets returns packets for given IDs`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        val event1 = TestData.getEventEntity(
            eventId = "event-id-1",
            sessionId = "session-id",
        )
        val event2 = TestData.getEventEntity(
            eventId = "event-id-2",
            sessionId = "session-id",
        )
        val event3 = TestData.getEventEntity(
            eventId = "event-id-3",
            sessionId = "session-id",
        )
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertEvent(event3)

        // when
        val packets = database.getEventPackets(listOf("event-id-1", "event-id-3"))

        // then
        assertEquals(2, packets.size)
        val packetIds = packets.map { it.eventId }
        assertTrue(packetIds.contains("event-id-1"))
        assertTrue(packetIds.contains("event-id-3"))
        assertFalse(packetIds.contains("event-id-2"))

        // verify packet data
        val packet1 = packets.first { it.eventId == "event-id-1" }
        assertEventPacket(event1, packet1)
    }

    @Test
    fun `getEventPackets returns empty list for non-existent IDs`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-id-1",
                sessionId = "session-id",
            ),
        )

        // when
        val packets = database.getEventPackets(listOf("non-existent-1", "non-existent-2"))

        // then
        assertTrue(packets.isEmpty())
    }

    @Test
    fun `getEventsForSession returns event IDs for session`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-2"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-1",
                sessionId = "session-1",
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-2",
                sessionId = "session-1",
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-3",
                sessionId = "session-2",
            ),
        )

        // when
        val eventIds = database.getEventsForSession("session-1")

        // then
        assertEquals(2, eventIds.size)
        assertTrue(eventIds.contains("event-1"))
        assertTrue(eventIds.contains("event-2"))
        assertFalse(eventIds.contains("event-3"))
    }

    @Test
    fun `getEventsCount returns total count`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-2"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-1",
                sessionId = "session-1",
                isSampled = false,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-2",
                sessionId = "session-1",
                isSampled = true,
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-3",
                sessionId = "session-2",
                isSampled = false,
            ),
        )

        // when
        val count = database.getEventsCount()

        // then
        assertEquals(3, count)
    }

    @Test
    fun `getEventsCount for sessionId returns count for that session`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-2"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-1",
                sessionId = "session-1",
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-2",
                sessionId = "session-1",
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-3",
                sessionId = "session-2",
            ),
        )

        // when
        val countSession1 = database.getEventsCount("session-1")
        val countSession2 = database.getEventsCount("session-2")

        // then
        assertEquals(2, countSession1)
        assertEquals(1, countSession2)
    }

    @Test
    fun `deleteEvents excludes current session and batched events`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "current-session"))
        database.insertSession(TestData.getSessionEntity(id = "other-session"))

        // event in current session - should not be deleted
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-current-session",
                sessionId = "current-session",
                isSampled = false,
            ),
        )

        // event in other session with sampled = false - should be deleted
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-to-delete",
                sessionId = "other-session",
                isSampled = false,
            ),
        )

        // event in other session with sampled = true - should not be deleted
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "sampled-event",
                sessionId = "other-session",
                isSampled = true,
            ),
        )

        // batched event in other session - should not be deleted
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-batched",
                sessionId = "other-session",
                isSampled = false,
            ),
        )
        database.insertBatch(
            BatchEntity(
                batchId = "batch-id",
                eventIds = setOf("event-batched"),
                spanIds = emptySet(),
                createdAt = 1234567890L,
            ),
        )

        // when
        val deletedEventIds = database.deleteEvents(
            excludeSessionId = "current-session",
            batchSize = 100,
        )

        // then
        assertEquals(1, deletedEventIds.size)
        assertTrue(deletedEventIds.contains("event-to-delete"))

        // verify remaining events
        val db = database.readableDatabase
        queryAllEvents(db).use { cursor ->
            assertEquals(3, cursor.count)
            val remainingIds = mutableSetOf<String>()
            while (cursor.moveToNext()) {
                remainingIds.add(cursor.getString(cursor.getColumnIndex(EventTable.COL_ID)))
            }
            assertTrue(remainingIds.contains("event-current-session"))
            assertTrue(remainingIds.contains("sampled-event"))
            assertTrue(remainingIds.contains("event-batched"))
        }
    }

    @Test
    fun `deleteEvents respects batchSize limit`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "current-session"))
        database.insertSession(TestData.getSessionEntity(id = "other-session"))

        // insert multiple events that can be deleted
        for (i in 1..5) {
            database.insertEvent(
                TestData.getEventEntity(
                    eventId = "event-$i",
                    sessionId = "other-session",
                    isSampled = false,
                ),
            )
        }

        // when - delete with batchSize of 2
        val deletedEventIds = database.deleteEvents(
            excludeSessionId = "current-session",
            batchSize = 2,
        )

        // then
        assertEquals(2, deletedEventIds.size)

        // verify 3 events remain
        val db = database.readableDatabase
        queryAllEvents(db).use { cursor ->
            assertEquals(3, cursor.count)
        }
    }

    @Test
    fun `markTimelineForReporting marks events within time window and session as priority`() {
        // given
        val endTimestamp = "2026-01-01T10:01:00.000Z"
        val withinWindow1 = "2026-01-01T10:00:30.000Z"
        val withinWindow2 = "2026-01-01T10:01:00.000Z"
        val beforeWindow = "2026-01-01T09:59:59.000Z"
        val afterWindow = "2026-01-01T10:01:01.000Z"
        val durationSeconds = 60

        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id",
                prioritySession = false,
            ),
        )

        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-in-window-1",
                sessionId = "session-id",
                timestamp = withinWindow1,
                isSampled = false,
            ),
        )

        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-in-window-2",
                sessionId = "session-id",
                timestamp = withinWindow2,
                isSampled = false,
            ),
        )

        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-before-window",
                sessionId = "session-id",
                timestamp = beforeWindow,
                isSampled = false,
            ),
        )

        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-after-window",
                sessionId = "session-id",
                timestamp = afterWindow,
                isSampled = false,
            ),
        )

        // when
        database.markTimelineForReporting(
            timestamp = endTimestamp,
            durationSeconds = durationSeconds,
            sessionId = "session-id",
        )

        // then
        val db = database.readableDatabase
        db.query(
            EventTable.TABLE_NAME,
            arrayOf(EventTable.COL_ID, EventTable.COL_SAMPLED),
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            val eventReportingStatus = mutableMapOf<String, Boolean>()
            while (cursor.moveToNext()) {
                val eventId = cursor.getString(cursor.getColumnIndex(EventTable.COL_ID))
                val sampled =
                    cursor.getInt(cursor.getColumnIndex(EventTable.COL_SAMPLED)) == 1
                eventReportingStatus[eventId] = sampled
            }

            assertTrue(eventReportingStatus["event-in-window-1"] == true)
            assertTrue(eventReportingStatus["event-in-window-2"] == true)
            assertFalse(eventReportingStatus["event-before-window"] == true)
            assertFalse(eventReportingStatus["event-after-window"] == true)
        }

        // verify session marked as priority
        db.query(
            SessionsTable.TABLE_NAME,
            arrayOf(SessionsTable.COL_PRIORITY_SESSION),
            "${SessionsTable.COL_SESSION_ID} = ?",
            arrayOf("session-id"),
            null,
            null,
            null,
        ).use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals(
                1,
                cursor.getInt(cursor.getColumnIndex(SessionsTable.COL_PRIORITY_SESSION)),
            )
        }
    }

    @Test
    fun `insertSpan returns true on success`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        val span = TestData.getSpanEntity(
            spanId = "span-id",
            sessionId = "session-id",
        )

        // when
        val result = database.insertSpan(span)

        // then
        assertTrue(result)

        val db = database.readableDatabase
        queryAllSpans(db).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals("span-id", cursor.getString(cursor.getColumnIndex(SpansTable.COL_SPAN_ID)))
        }
    }

    @Test
    fun `insertSpan returns false for duplicate spanId`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        val span = TestData.getSpanEntity(
            spanId = "span-id",
            sessionId = "session-id",
        )
        database.insertSpan(span)

        // when
        val result = database.insertSpan(span)

        // then
        assertFalse(result)

        val db = database.readableDatabase
        queryAllSpans(db).use { cursor ->
            assertEquals(1, cursor.count)
        }
    }

    @Test
    fun `getSpanPackets returns packets for given IDs`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        val span1 = TestData.getSpanEntity(
            spanId = "span-id-1",
            sessionId = "session-id",
        )
        val span2 = TestData.getSpanEntity(
            spanId = "span-id-2",
            sessionId = "session-id",
        )
        val span3 = TestData.getSpanEntity(
            spanId = "span-id-3",
            sessionId = "session-id",
        )
        database.insertSpan(span1)
        database.insertSpan(span2)
        database.insertSpan(span3)

        // when
        val packets = database.getSpanPackets(listOf("span-id-1", "span-id-3"))

        // then
        assertEquals(2, packets.size)
        val packetIds = packets.map { it.spanId }
        assertTrue(packetIds.contains("span-id-1"))
        assertTrue(packetIds.contains("span-id-3"))
        assertFalse(packetIds.contains("span-id-2"))
    }

    @Test
    fun `getSpansCount returns total and per-session counts`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-2"))
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-1",
                sessionId = "session-1",
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-2",
                sessionId = "session-1",
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-3",
                sessionId = "session-2",
            ),
        )

        // when
        val totalCount = database.getSpansCount()
        val countSession1 = database.getSpansCount("session-1")
        val countSession2 = database.getSpansCount("session-2")

        // then
        assertEquals(3, totalCount)
        assertEquals(2, countSession1)
        assertEquals(1, countSession2)
    }

    @Test
    fun `deleteSpans excludes current session and batched spans`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "current-session"))
        database.insertSession(TestData.getSessionEntity(id = "other-session"))

        // span in current session - should not be deleted
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-current-session",
                sessionId = "current-session",
                isSampled = false,
            ),
        )

        // span in other session with sampled = false - should be deleted
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-to-delete",
                sessionId = "other-session",
                isSampled = false,
            ),
        )

        // span in other session with sampled = true - should not be deleted
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-sampled",
                sessionId = "other-session",
                isSampled = true,
            ),
        )

        // batched span in other session - should not be deleted
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-batched",
                sessionId = "other-session",
                isSampled = false,
            ),
        )
        database.insertBatch(
            BatchEntity(
                batchId = "batch-id",
                eventIds = emptySet(),
                spanIds = setOf("span-batched"),
                createdAt = 1234567890L,
            ),
        )

        // when
        val deletedSpanIds = database.deleteSpans(
            excludeSessionId = "current-session",
            batchSize = 100,
        )

        // then
        assertEquals(1, deletedSpanIds.size)
        assertTrue(deletedSpanIds.contains("span-to-delete"))

        // verify remaining spans
        val db = database.readableDatabase
        queryAllSpans(db).use { cursor ->
            assertEquals(3, cursor.count)
            val remainingIds = mutableSetOf<String>()
            while (cursor.moveToNext()) {
                remainingIds.add(cursor.getString(cursor.getColumnIndex(SpansTable.COL_SPAN_ID)))
            }
            assertTrue(remainingIds.contains("span-current-session"))
            assertTrue(remainingIds.contains("span-sampled"))
            assertTrue(remainingIds.contains("span-batched"))
        }
    }

    @Test
    fun `getAttachmentsForEvents returns attachment IDs`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-1",
                sessionId = "session-id",
                attachmentEntities = listOf(
                    TestData.getAttachmentEntity(id = "attachment-1"),
                    TestData.getAttachmentEntity(id = "attachment-2"),
                ),
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-2",
                sessionId = "session-id",
                attachmentEntities = listOf(
                    TestData.getAttachmentEntity(id = "attachment-3"),
                ),
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-3",
                sessionId = "session-id",
                attachmentEntities = emptyList(),
            ),
        )

        // when
        val attachmentIds = database.getAttachmentsForEvents(listOf("event-1", "event-3"))

        // then
        assertEquals(2, attachmentIds.size)
        assertTrue(attachmentIds.contains("attachment-1"))
        assertTrue(attachmentIds.contains("attachment-2"))
        assertFalse(attachmentIds.contains("attachment-3"))
    }

    @Test
    fun `getAttachmentsToUpload returns attachments with signed URLs`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-1",
                sessionId = "session-id",
                attachmentEntities = listOf(
                    TestData.getAttachmentEntity(id = "attachment-with-url"),
                    TestData.getAttachmentEntity(id = "attachment-without-url"),
                ),
            ),
        )

        // set signed URL for one attachment
        database.updateAttachmentUrls(
            listOf(
                SignedAttachment(
                    id = "attachment-with-url",
                    type = "screenshot",
                    filename = "screenshot.png",
                    uploadUrl = "https://example.com/upload",
                    expiresAt = "2025-01-15T10:00:00.000Z",
                    headers = mapOf("Authorization" to "Bearer token"),
                ),
            ),
        )

        // when
        val attachments = database.getAttachmentsToUpload(maxCount = 10)

        // then
        assertEquals(1, attachments.size)
        val attachment = attachments.first()
        assertEquals("attachment-with-url", attachment.id)
        assertEquals("https://example.com/upload", attachment.url)
        assertEquals("2025-01-15T10:00:00.000Z", attachment.expiresAt)
        assertEquals("session-id", attachment.sessionId)
        assertEquals(mapOf("Authorization" to "Bearer token"), attachment.headers)
    }

    @Test
    fun `updateAttachmentUrls returns false when attachment missing`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-1",
                sessionId = "session-id",
                attachmentEntities = listOf(
                    TestData.getAttachmentEntity(id = "attachment-1"),
                ),
            ),
        )

        // when
        val result = database.updateAttachmentUrls(
            listOf(
                SignedAttachment(
                    id = "non-existent-attachment",
                    type = "screenshot",
                    filename = "screenshot.png",
                    uploadUrl = "https://example.com/upload",
                    expiresAt = "2025-01-15T10:00:00.000Z",
                    headers = mapOf(),
                ),
            ),
        )

        // then
        assertFalse(result)
    }

    @Test
    fun `deleteAttachment removes single attachment`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-1",
                sessionId = "session-id",
                attachmentEntities = listOf(
                    TestData.getAttachmentEntity(id = "attachment-1"),
                    TestData.getAttachmentEntity(id = "attachment-2"),
                ),
            ),
        )

        // when
        val result = database.deleteAttachment("attachment-1")

        // then
        assertTrue(result)

        val db = database.readableDatabase
        db.query(
            AttachmentV1Table.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "attachment-2",
                cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_ID)),
            )
        }
    }

    @Test
    fun `deleteAttachments removes multiple attachments`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-1",
                sessionId = "session-id",
                attachmentEntities = listOf(
                    TestData.getAttachmentEntity(id = "attachment-1"),
                    TestData.getAttachmentEntity(id = "attachment-2"),
                    TestData.getAttachmentEntity(id = "attachment-3"),
                ),
            ),
        )

        // when
        database.deleteAttachments(listOf("attachment-1", "attachment-3"))

        // then
        val db = database.readableDatabase
        db.query(
            AttachmentV1Table.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "attachment-2",
                cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_ID)),
            )
        }
    }

    @Test
    fun `deleteBatch removes batch and associated events and spans`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-to-delete-1",
                sessionId = "session-id",
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-to-delete-2",
                sessionId = "session-id",
            ),
        )
        database.insertEvent(
            TestData.getEventEntity(
                eventId = "event-to-keep",
                sessionId = "session-id",
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-to-delete-1",
                sessionId = "session-id",
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-to-delete-2",
                sessionId = "session-id",
            ),
        )
        database.insertSpan(
            TestData.getSpanEntity(
                spanId = "span-to-keep",
                sessionId = "session-id",
            ),
        )

        database.insertBatch(
            BatchEntity(
                batchId = "batch-to-delete",
                eventIds = setOf("event-to-delete-1", "event-to-delete-2"),
                spanIds = setOf("span-to-delete-1", "span-to-delete-2"),
                createdAt = 1234567890L,
            ),
        )

        // when
        database.deleteBatch(
            batchId = "batch-to-delete",
            eventIds = listOf("event-to-delete-1", "event-to-delete-2"),
            spanIds = listOf("span-to-delete-1", "span-to-delete-2"),
        )

        // then
        val db = database.readableDatabase

        // verify batch removed
        db.query(
            BatchesTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            assertEquals(0, cursor.count)
        }

        // verify events removed
        queryAllEvents(db).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "event-to-keep",
                cursor.getString(cursor.getColumnIndex(EventTable.COL_ID)),
            )
        }

        // verify spans removed
        queryAllSpans(db).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "span-to-keep",
                cursor.getString(cursor.getColumnIndex(SpansTable.COL_SPAN_ID)),
            )
        }
    }

    @Test
    fun `getSessionForAppExit returns session for PID`() {
        // given
        val pid = 12345
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id",
                pid = pid,
                createdAt = 1000L,
                appVersion = "1.0.0",
                appBuild = "100",
                supportsAppExit = true,
            ),
        )

        // when
        val session = database.getSessionForAppExit(pid)

        // then
        assertNotNull(session)
        assertEquals("session-id", session!!.id)
        assertEquals(pid, session.pid)
        assertEquals(1000L, session.createdAt)
        assertEquals("1.0.0", session.appVersion)
        assertEquals("100", session.appBuild)
    }

    @Test
    fun `getSessionForAppExit returns most recent when multiple sessions share PID`() {
        // given
        val pid = 12345
        database.insertSession(
            TestData.getSessionEntity(
                id = "older-session",
                pid = pid,
                createdAt = 1000L,
                supportsAppExit = true,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "newer-session",
                pid = pid,
                createdAt = 2000L,
                supportsAppExit = true,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "newest-session",
                pid = pid,
                createdAt = 3000L,
                supportsAppExit = true,
            ),
        )

        // when
        val session = database.getSessionForAppExit(pid)

        // then
        assertNotNull(session)
        assertEquals("newest-session", session!!.id)
        assertEquals(3000L, session.createdAt)
    }

    @Test
    fun `getSessionForAppExit returns null for unknown PID`() {
        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id",
                pid = 12345,
                supportsAppExit = true,
            ),
        )

        // when
        val session = database.getSessionForAppExit(99999)

        // then
        assertNull(session)
    }

    @Test
    fun `clearAppExitRecords removes all records except for current session`() {
        // given
        database.insertSession(
            TestData.getSessionEntity(
                id = "old-session",
                pid = 111,
                createdAt = 1000L,
                supportsAppExit = true,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "boundary-session",
                pid = 222,
                createdAt = 2000L,
                supportsAppExit = true,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "current-session",
                pid = 333,
                createdAt = 3000L,
                supportsAppExit = true,
            ),
        )

        // when
        database.clearAppExitRecords("current-session")

        // then
        val db = database.readableDatabase
        db.query(
            AppExitTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            assertEquals(1, cursor.count)
            assertTrue(cursor.moveToFirst())
            assertEquals(
                "current-session",
                cursor.getString(cursor.getColumnIndex(AppExitTable.COL_SESSION_ID)),
            )
        }
    }

    @Test
    fun `insertSignals inserts events and spans atomically`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        val attachment = TestData.getAttachmentEntity(id = "attachment-1")
        val event1 = TestData.getEventEntity(
            eventId = "event-1",
            sessionId = "session-id",
            attachmentEntities = listOf(attachment),
        )
        val event2 = TestData.getEventEntity(
            eventId = "event-2",
            sessionId = "session-id",
            attachmentEntities = emptyList(),
        )
        val span1 = TestData.getSpanEntity(
            spanId = "span-1",
            sessionId = "session-id",
        )
        val span2 = TestData.getSpanEntity(
            spanId = "span-2",
            sessionId = "session-id",
        )

        // when
        val result = database.insertSignals(
            eventEntities = listOf(event1, event2),
            spanEntities = listOf(span1, span2),
        )

        // then
        assertTrue(result)
        assertEquals(2, database.getEventsCount())
        assertEquals(2, database.getSpansCount())

        val attachments = database.getAttachmentsForEvents(listOf("event-1", "event-2"))
        assertEquals(1, attachments.size)
        assertTrue(attachments.contains("attachment-1"))
    }

    @Test
    fun `insertSignals rolls back on failure`() {
        // given
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        val event1 = TestData.getEventEntity(
            eventId = "event-1",
            sessionId = "session-id",
        )
        val span1 = TestData.getSpanEntity(
            spanId = "span-1",
            sessionId = "session-id",
        )
        // duplicate span ID causes failure
        val duplicateSpan = TestData.getSpanEntity(
            spanId = "span-1",
            sessionId = "session-id",
        )

        // when
        val result = database.insertSignals(
            eventEntities = listOf(event1),
            spanEntities = listOf(span1, duplicateSpan),
        )

        // then
        assertFalse(result)
        assertEquals(0, database.getEventsCount())
        assertEquals(0, database.getSpansCount())
    }

    private fun queryAllEvents(db: SQLiteDatabase): Cursor = db.query(
        EventTable.TABLE_NAME,
        null,
        null,
        null,
        null,
        null,
        null,
    )

    private fun queryAllSpans(db: SQLiteDatabase): Cursor = db.query(
        SpansTable.TABLE_NAME,
        null,
        null,
        null,
        null,
        null,
        null,
    )

    private fun queryAttachmentsForEvent(db: SQLiteDatabase, eventId: String): Cursor = db.query(
        AttachmentV1Table.TABLE_NAME,
        null,
        "${AttachmentV1Table.COL_EVENT_ID} = ?",
        arrayOf(eventId),
        null,
        null,
        null,
    )

    /**
     * Asserts that the event in the cursor matches the expected event.
     *
     * @param expectedEvent The expected event.
     * @param cursor The cursor to assert.
     */
    private fun assertEventInCursor(expectedEvent: EventEntity, cursor: Cursor) {
        assertEquals(expectedEvent.id, cursor.getString(cursor.getColumnIndex(EventTable.COL_ID)))
        assertEquals(
            expectedEvent.type.value,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_TYPE)),
        )
        assertEquals(
            expectedEvent.timestamp,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_TIMESTAMP)),
        )
        assertEquals(
            expectedEvent.sessionId,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_SESSION_ID)),
        )
        assertEquals(
            expectedEvent.userTriggered,
            cursor.getInt(cursor.getColumnIndex(EventTable.COL_USER_TRIGGERED)) == 1,
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
            expectedEvent.serializedUserDefAttributes,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_USER_DEFINED_ATTRIBUTES)),
        )
        assertEquals(
            expectedEvent.attachmentsSize,
            cursor.getLong(cursor.getColumnIndex(EventTable.COL_ATTACHMENT_SIZE)),
        )
        assertEquals(
            expectedEvent.serializedAttachments,
            cursor.getString(cursor.getColumnIndex(EventTable.COL_ATTACHMENTS)),
        )
        assertEquals(
            expectedEvent.isSampled,
            cursor.getInt(cursor.getColumnIndex(EventTable.COL_SAMPLED)) == 1,
        )
    }

    private fun assertAttachmentInCursor(
        attachmentEntity: AttachmentEntity,
        event: EventEntity,
        cursor: Cursor,
    ) {
        assertEquals(
            attachmentEntity.id,
            cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_ID)),
        )
        assertEquals(
            attachmentEntity.type,
            cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_TYPE)),
        )
        assertEquals(
            attachmentEntity.path,
            cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_FILE_PATH)),
        )
        assertEquals(
            attachmentEntity.name,
            cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_NAME)),
        )
        assertEquals(
            event.timestamp,
            cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_TIMESTAMP)),
        )
        assertEquals(
            event.sessionId,
            cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_SESSION_ID)),
        )
        assertEquals(
            event.id,
            cursor.getString(cursor.getColumnIndex(AttachmentV1Table.COL_EVENT_ID)),
        )
    }

    private fun assertEventPacket(event: EventEntity, eventPacket: EventPacket) {
        assertEquals(event.id, eventPacket.eventId)
        assertEquals(event.type, eventPacket.type)
        assertEquals(event.timestamp, eventPacket.timestamp)
        assertEquals(event.sessionId, eventPacket.sessionId)
        assertEquals(event.serializedData, eventPacket.serializedData)
        assertEquals(event.serializedAttributes, eventPacket.serializedAttributes)
        assertEquals(event.serializedAttachments, eventPacket.serializedAttachments)
        assertEquals(event.filePath, eventPacket.serializedDataFilePath)
    }
}
