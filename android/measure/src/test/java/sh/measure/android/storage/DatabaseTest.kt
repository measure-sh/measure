package sh.measure.android.storage

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import sh.measure.android.events.EventType
import sh.measure.android.exporter.EventPacket
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData

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
            assertEquals(SessionsTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(EventTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(AttachmentTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(BatchesTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(EventsBatchTable.TABLE_NAME, it.getString(it.getColumnIndex("name")))
            it.moveToNext()
            assertEquals(
                UserDefinedAttributesTable.TABLE_NAME,
                it.getString(it.getColumnIndex("name")),
            )
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
        queryAllEvents(db).use {
            it.moveToFirst()
            assertEventInCursor(eventWithAttachment, it)
        }
        queryAttachmentsForEvent(db, eventWithAttachment.id).use {
            it.moveToFirst()
            assertAttachmentInCursor(attachmentEntity, eventWithAttachment, it)
        }
    }

    @Test
    fun `insertEvent returns true when event without attachment is successfully inserted`() {
        // given
        val event =
            TestData.getEventEntity(sessionId = "session-id-1", attachmentEntities = emptyList())
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))

        // when
        val result = database.insertEvent(event)

        // then
        val db = database.writableDatabase
        assertTrue(result)
        queryAllEvents(db).use {
            it.moveToFirst()
            assertEventInCursor(event, it)
        }
    }

    @Test
    fun `insertEvent returns false when event insertion fails`() {
        // given
        val event = TestData.getEventEntity(sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))

        // when
        database.insertEvent(event)
        // attempt to insert a event with same ID twice, resulting in a failure
        val result = database.insertEvent(event)

        // then
        assertEquals(false, result)
        queryAllEvents(database.writableDatabase).use {
            assertEquals(1, it.count)
        }
    }

    @Test
    fun `insertEvent returns false when event insertion fails due to attachment insertion failure`() {
        // given
        val event = TestData.getEventEntity(
            sessionId = "session-id-1",
            attachmentEntities = listOf(
                TestData.getAttachmentEntity(id = "attachment-id-1"),
                // attempt inserting attachment with same ID twice, resulting in a failure.
                TestData.getAttachmentEntity(id = "attachment-id-1"),
            ),
        )
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))

        // when
        val result = database.insertEvent(event)

        // then
        assertEquals(false, result)
        queryAllEvents(database.writableDatabase).use {
            assertEquals(0, it.count)
        }
    }

    @Test
    fun `insertEvent returns false when event is inserted for a session that does not exist`() {
        // given
        val event = TestData.getEventEntity(sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-2"))

        // when
        val result = database.insertEvent(event)

        // then
        assertFalse(result)
        queryAllEvents(database.writableDatabase).use {
            assertEquals(0, it.count)
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
                "batch-id",
                eventIds = listOf(event1.id, event2.id),
                spanIds = listOf(span1.spanId, span2.spanId),
                createdAt = 1234567890L,
            ),
        )

        // then
        assertEquals(true, result)
        queryAllBatches().use {
            assertEquals(1, it.count)
            it.moveToFirst()
            assertBatchInCursor("batch-id", it)
        }
        queryAllEventBatches().use {
            assertEquals(2, it.count)
        }
        queryAllSpanBatches().use {
            assertEquals(2, it.count)
        }
    }

    @Test
    fun `insertBatch returns false when event batch insertion fails`() {
        // attempt to insert a event with same ID twice, resulting in a failure
        val result = database.insertBatch(
            BatchEntity(
                "batch-id",
                eventIds = listOf("valid-id", "event-id", "event-id"),
                spanIds = emptyList(),
                createdAt = 987654321L,
            ),
        )
        queryAllEventBatches().use {
            assertEquals(0, it.count)
        }
        assertEquals(false, result)
    }

    @Test
    fun `insertBatch returns false when span batch insertion fails`() {
        // attempt to insert a event with same ID twice, resulting in a failure
        val result = database.insertBatch(
            BatchEntity(
                "batch-id",
                eventIds = emptyList(),
                spanIds = listOf("valid-id", "span-id", "span-id"),
                createdAt = 987654321L,
            ),
        )
        queryAllEventBatches().use {
            assertEquals(0, it.count)
        }
        assertEquals(false, result)
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
                "batch-id",
                eventIds = listOf(event1.id, eventNotInEventsTable.id),
                spanIds = emptyList(),
                createdAt = 1234567890L,
            ),
        )
        assertEquals(false, result)
        queryAllEventBatches().use {
            assertEquals(0, it.count)
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
                "batch-id",
                eventIds = emptyList(),
                spanIds = listOf(span1.spanId, spanNotInSpansTable.spanId),
                createdAt = 1234567890L,
            ),
        )
        assertEquals(false, result)
        queryAllSpanBatches().use {
            assertEquals(0, it.count)
        }
    }

    @Test
    fun `getUnBatchedEventsWithAttachmentSize returns events from session that needs reporting, but discards already batched events`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-1")
        val batchedEvent =
            TestData.getEventEntity(eventId = "event-id-3", sessionId = "session-id-1")
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                needsReporting = true,
            ),
        )
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertEvent(batchedEvent)
        database.insertBatch(
            TestData.getEventBatchEntity(batchId = "batch-id", eventIds = listOf(batchedEvent.id)),
        )

        // when
        val eventsToBatch = database.getUnBatchedEventsWithAttachmentSize(100)

        // then
        assertEquals(2, eventsToBatch.size)
    }

    @Test
    fun `getUnBatchedEventsWithAttachmentSize returns events, but discards events from sessions that do not need reporting`() {
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-2")
        val event3 = TestData.getEventEntity(eventId = "event-id-3", sessionId = "session-id-2")
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                needsReporting = true,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-2",
                needsReporting = false,
            ),
        )
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertEvent(event3)

        val eventsToBatch = database.getUnBatchedEventsWithAttachmentSize(100)
        assertEquals(1, eventsToBatch.size)
    }

    @Test
    fun `getUnBatchedEventsWithAttachmentSize given a session ID, returns all events from the given sessions, even if session doe not need reporting`() {
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-1")
        val event3 = TestData.getEventEntity(eventId = "event-id-3", sessionId = "session-id-2")
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                needsReporting = true,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-2",
                needsReporting = false,
            ),
        )
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertEvent(event3)

        val eventsToBatch =
            database.getUnBatchedEventsWithAttachmentSize(100, sessionId = "session-id-1")
        assertEquals(2, eventsToBatch.size)
    }

    @Test
    fun `getUnBatchedEventsWithAttachmentSize given allowed event types, returns all events of given event types, even if session does not need reporting`() {
        // given
        val hotLaunchEvent = TestData.getEventEntity(
            eventId = "event-id-1",
            sessionId = "session-id-1",
            type = EventType.HOT_LAUNCH,
        )
        val coldLaunchEvent = TestData.getEventEntity(
            eventId = "event-id-2",
            sessionId = "session-id-1",
            type = EventType.COLD_LAUNCH,
        )
        val warmLaunchEvent = TestData.getEventEntity(
            eventId = "event-id-3",
            sessionId = "session-id-2",
            type = EventType.WARM_LAUNCH,
        )
        val nonLaunchEvent = TestData.getEventEntity(
            eventId = "event-id-4",
            sessionId = "session-id-2",
            type = EventType.STRING,
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                needsReporting = false,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-2",
                needsReporting = false,
            ),
        )
        database.insertEvent(hotLaunchEvent)
        database.insertEvent(coldLaunchEvent)
        database.insertEvent(warmLaunchEvent)
        database.insertEvent(nonLaunchEvent)

        // when
        val eventsToBatch = database.getUnBatchedEventsWithAttachmentSize(
            100,
            // allow all launch event types
            eventTypeExportAllowList = listOf(
                EventType.COLD_LAUNCH,
                EventType.HOT_LAUNCH,
                EventType.WARM_LAUNCH,
            ),
        )

        // then
        assertEquals(3, eventsToBatch.size)
    }

    @Test
    fun `getUnBatchedEventsWithAttachmentSize given sessions which need reporting, respects the maximum number of events to return`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-1")
        val event3 = TestData.getEventEntity(eventId = "event-id-3", sessionId = "session-id-2")
        val event4 = TestData.getEventEntity(eventId = "event-id-4", sessionId = "session-id-2")
        val event5 = TestData.getEventEntity(eventId = "event-id-5", sessionId = "session-id-2")
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-1",
                needsReporting = true,
            ),
        )
        database.insertSession(
            TestData.getSessionEntity(
                id = "session-id-2",
                needsReporting = true,
            ),
        )
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertEvent(event3)
        database.insertEvent(event4)
        database.insertEvent(event5)

        // when
        val eventsToBatch = database.getUnBatchedEventsWithAttachmentSize(3)

        // then
        assertEquals(3, eventsToBatch.size)
    }

    @Test
    fun `getUnBatchedSpans returns sampled spans, but discards already batched spans`() {
        // given
        val span1 = TestData.getSpanEntity(spanId = "span-id-1", sessionId = "session-id-1")
        val span2 = TestData.getSpanEntity(spanId = "span-id-2", sessionId = "session-id-1")
        val batchedSpan = TestData.getSpanEntity(spanId = "span-id-3", sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertSpan(span1)
        database.insertSpan(span2)
        database.insertSpan(batchedSpan)
        database.insertBatch(
            TestData.getEventBatchEntity(
                batchId = "batch-id",
                spanIds = listOf(batchedSpan.spanId),
            ),
        )

        // when
        val spansToBatch = database.getUnBatchedSpans(100)

        // then
        assertEquals(2, spansToBatch.size)
    }

    @Test
    fun `getUnBatchedSpans returns sampled spans, respects the maximum number of spans to return`() {
        // given
        val span1 = TestData.getSpanEntity(spanId = "span-id-1", sessionId = "session-id-1")
        val span2 = TestData.getSpanEntity(spanId = "span-id-2", sessionId = "session-id-1")
        val span3 = TestData.getSpanEntity(spanId = "span-id-3", sessionId = "session-id-2")
        val span4 = TestData.getSpanEntity(spanId = "span-id-4", sessionId = "session-id-2")
        val span5 = TestData.getSpanEntity(spanId = "span-id-5", sessionId = "session-id-2")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-id-2"))
        database.insertSpan(span1)
        database.insertSpan(span2)
        database.insertSpan(span3)
        database.insertSpan(span4)
        database.insertSpan(span5)

        // when
        val spansToBatch = database.getUnBatchedSpans(3)

        // then
        assertEquals(3, spansToBatch.size)
    }

    @Test
    fun `getEventPackets returns event packets for given event IDs`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertEvent(event1)
        database.insertEvent(event2)

        // when
        val eventPackets = database.getEventPackets(listOf(event1.id, event2.id))

        // then
        assertEquals(2, eventPackets.size)
        assertEventPacket(event1, eventPackets[0])
        assertEventPacket(event2, eventPackets[1])
    }

    @Test
    fun `getEventPackets returns empty list when no events are found`() {
        // when
        val eventPackets = database.getEventPackets(listOf("event-id-1", "event-id-2"))

        // then
        assertEquals(0, eventPackets.size)
    }

    @Test
    fun `getAttachmentPackets returns empty list if events do not contain attachments`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertEvent(event1)
        database.insertEvent(event2)

        // when
        val attachmentPackets = database.getAttachmentPackets(listOf(event1.id, event2.id))

        // then
        assertEquals(0, attachmentPackets.size)
    }

    @Test
    fun `getAttachmentPackets returns attachment packets when events contain attachments`() {
        // given
        val eventWithAttachment = TestData.getEventEntity(
            eventId = "event-id-1",
            sessionId = "session-id-1",
            attachmentEntities = listOf(TestData.getAttachmentEntity(id = "attachment-id-1")),
        )
        val eventWithMultipleAttachments = TestData.getEventEntity(
            eventId = "event-id-2",
            sessionId = "session-id-1",
            attachmentEntities = listOf(
                TestData.getAttachmentEntity(id = "attachment-id-2"),
                TestData.getAttachmentEntity(id = "attachment-id-3"),
            ),
        )
        val eventWithDifferentSession = TestData.getEventEntity(
            eventId = "event-id-3",
            sessionId = "session-id-2",
            attachmentEntities = listOf(TestData.getAttachmentEntity(id = "attachment-id-4")),
        )
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-id-2"))
        database.insertEvent(eventWithAttachment)
        database.insertEvent(eventWithMultipleAttachments)
        database.insertEvent(eventWithDifferentSession)

        // when
        val attachmentPackets = database.getAttachmentPackets(
            listOf(
                eventWithAttachment.id,
                eventWithMultipleAttachments.id,
                eventWithDifferentSession.id,
            ),
        )

        // then
        assertEquals(4, attachmentPackets.size)
        assertEquals("attachment-id-1", attachmentPackets[0].id)
        assertEquals("attachment-id-2", attachmentPackets[1].id)
        assertEquals("attachment-id-3", attachmentPackets[2].id)
        assertEquals("attachment-id-4", attachmentPackets[3].id)
    }

    @Test
    fun `getBatches returns all batches with event IDs and span IDs`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-1")
        val span1 = TestData.getSpanEntity(spanId = "span-id-1", sessionId = "session-id-1")
        val span2 = TestData.getSpanEntity(spanId = "span-id-2", sessionId = "session-id-1")
        database.insertSession(
            SessionEntity(
                "session-id-1",
                123,
                500,
                true,
                supportsAppExit = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
            ),
        )
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertSpan(span1)
        database.insertSpan(span2)

        // when
        database.insertBatch(
            BatchEntity(
                "batch-id-1",
                eventIds = listOf(event1.id, event2.id),
                spanIds = listOf(span1.spanId, span2.spanId),
                createdAt = 1234567890L,
            ),
        )

        // then
        val batches = database.getBatches(2)
        assertEquals(1, batches.size)
        assertEquals(2, batches.first().eventIds.size)
        assertEquals(2, batches.first().spanIds.size)
    }

    fun `getOldestSession returns oldest session`() {
        database.insertSession(TestData.getSessionEntity(id = "session-id-1", createdAt = 500))
        database.insertSession(TestData.getSessionEntity(id = "session-id-2", createdAt = 700))
        database.insertSession(TestData.getSessionEntity(id = "session-id-3", createdAt = 900))

        val sessionId = database.getOldestSession()
        assertEquals("session-id-1", sessionId)
    }

    @Test
    fun `getOldestSession returns null if no sessions exist in db`() {
        // when
        val sessionId = database.getOldestSession()

        // then
        assertNull(sessionId)
    }

    @Test
    fun `getOldestSession returns null when no session exists`() {
        // when
        val sessionId = database.getOldestSession()

        // then
        assertNull(sessionId)
    }

    @Test
    fun `insertSession inserts a new session successfully`() {
        // when
        database.insertSession(TestData.getSessionEntity("session-id-1"))

        // then
        val db = database.writableDatabase
        db.query(
            SessionsTable.TABLE_NAME,
            null,
            "${SessionsTable.COL_SESSION_ID} = ?",
            arrayOf("session-id-1"),
            null,
            null,
            null,
        ).use {
            assertEquals(1, it.count)
        }
    }

    @Test
    fun `insertSession inserts a new app exit entry successfully`() {
        // when
        database.insertSession(TestData.getSessionEntity("session-id-1", supportsAppExit = true))

        // then
        val db = database.writableDatabase
        db.query(
            AppExitTable.TABLE_NAME,
            null,
            "${AppExitTable.COL_SESSION_ID} = ?",
            arrayOf("session-id-1"),
            null,
            null,
            null,
        ).use {
            assertEquals(1, it.count)
        }
    }

    @Test
    fun `insertSession does not insert a new app exit entry`() {
        // when
        database.insertSession(TestData.getSessionEntity("session-id-1", supportsAppExit = false))

        // then
        val db = database.writableDatabase
        db.rawQuery("SELECT * FROM ${AppExitTable.TABLE_NAME}", null).use {
            assertEquals(0, it.count)
        }
    }

    @Test
    fun `updateSession creates new entry in app exit table`() {
        val session = TestData.getSessionEntity(pid = 1, supportsAppExit = true)
        database.insertSession(session)
        database.updateSessionPid(
            sessionId = session.sessionId,
            pid = 2,
            createdAt = session.createdAt,
            true,
        )
        database.readableDatabase.rawQuery("SELECT * FROM ${AppExitTable.TABLE_NAME}", null).use {
            assertEquals(2, it.count)
        }
    }

    @Test
    fun `markCrashedSession sets crashed and needs reporting to 1`() {
        // given
        database.insertSession(TestData.getSessionEntity("session-id-1"))
        database.insertSession(TestData.getSessionEntity("session-id-2"))

        // when
        database.markCrashedSession("session-id-1")

        // then
        val db = database.readableDatabase
        db.query(
            SessionsTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use {
            assertEquals(2, it.count)
            it.moveToFirst()
            assertEquals(1, it.getInt(it.getColumnIndex(SessionsTable.COL_CRASHED)))
            assertEquals(1, it.getInt(it.getColumnIndex(SessionsTable.COL_NEEDS_REPORTING)))
            it.moveToNext()
            assertEquals(0, it.getInt(it.getColumnIndex(SessionsTable.COL_CRASHED)))
            assertEquals(0, it.getInt(it.getColumnIndex(SessionsTable.COL_NEEDS_REPORTING)))
        }
    }

    @Test
    fun `markCrashedSessions marks multiple sessions as crashed and sets needs reporting`() {
        // given
        database.insertSession(TestData.getSessionEntity("session-id-1"))
        database.insertSession(TestData.getSessionEntity("session-id-2"))
        database.insertSession(TestData.getSessionEntity("session-id-3"))

        // when
        database.markCrashedSessions(listOf("session-id-1", "session-id-2"))

        // then
        val db = database.readableDatabase
        db.query(
            SessionsTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use {
            it.moveToFirst()
            assertEquals(1, it.getInt(it.getColumnIndex(SessionsTable.COL_CRASHED)))
            assertEquals(1, it.getInt(it.getColumnIndex(SessionsTable.COL_NEEDS_REPORTING)))
            it.moveToNext()
            assertEquals(1, it.getInt(it.getColumnIndex(SessionsTable.COL_CRASHED)))
            assertEquals(1, it.getInt(it.getColumnIndex(SessionsTable.COL_NEEDS_REPORTING)))
            it.moveToNext()
            assertEquals(0, it.getInt(it.getColumnIndex(SessionsTable.COL_CRASHED)))
            assertEquals(0, it.getInt(it.getColumnIndex(SessionsTable.COL_NEEDS_REPORTING)))
        }
    }

    @Test
    fun `getSessionIds returns session Ids that need reporting`() {
        // given
        database.insertSession(TestData.getSessionEntity("session-id-1", needsReporting = true))
        database.insertSession(TestData.getSessionEntity("session-id-2", needsReporting = false))

        // when
        val sessions = database.getSessionIds(
            needReporting = true,
            filterSessionIds = emptyList(),
            maxCount = 5,
        )

        // then
        assertEquals(1, sessions.size)
    }

    @Test
    fun `getSessionIds returns session Ids that need reporting, but filters given session IDs`() {
        // given
        database.insertSession(TestData.getSessionEntity("session-id-1", needsReporting = true))
        database.insertSession(TestData.getSessionEntity("session-id-2", needsReporting = true))
        database.insertSession(TestData.getSessionEntity("session-id-3", needsReporting = true))

        // when
        val sessions = database.getSessionIds(
            needReporting = true,
            filterSessionIds = listOf("session-id-2", "session-id-3"),
            maxCount = 5,
        )

        // then
        assertEquals(1, sessions.size)
    }

    @Test
    fun `getSessionIds returns session Ids that need reporting, and respects max count`() {
        // given
        database.insertSession(TestData.getSessionEntity("session-id-1", needsReporting = true))
        database.insertSession(TestData.getSessionEntity("session-id-2", needsReporting = true))

        // when
        val sessions = database.getSessionIds(
            needReporting = true,
            filterSessionIds = emptyList(),
            maxCount = 1,
        )

        // then
        assertEquals(1, sessions.size)
    }

    @Test
    fun `deleteSessions deletes sessions with given session IDs`() {
        // given
        database.insertSession(TestData.getSessionEntity("session-id-1"))
        database.insertSession(TestData.getSessionEntity("session-id-2"))
        database.insertSession(TestData.getSessionEntity("session-id-3"))

        // when
        database.deleteSessions(listOf("session-id-1", "session-id-2"))

        // then
        val db = database.writableDatabase
        db.query(
            SessionsTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use {
            assertEquals(1, it.count)
        }
    }

    @Test
    fun `deleteSessions also deletes events for the session`() {
        // given
        database.insertSession(TestData.getSessionEntity("session-id-1"))
        database.insertSession(TestData.getSessionEntity("session-id-2"))
        val eventToDelete =
            TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val eventToNotDelete =
            TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-2")
        database.insertEvent(eventToDelete)
        database.insertEvent(eventToNotDelete)

        // when
        database.deleteSessions(listOf("session-id-1"))

        // then
        database.readableDatabase.query(
            EventTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use {
            assertEquals(1, it.count)
            it.moveToFirst()
            assertEquals("event-id-2", it.getString(it.getColumnIndex(EventTable.COL_ID)))
        }
    }

    @Test
    fun `deleteSessions also deletes spans for the session`() {
        // given
        database.insertSession(TestData.getSessionEntity("session-id-1"))
        database.insertSession(TestData.getSessionEntity("session-id-2"))
        val spanToDelete =
            TestData.getSpanEntity(spanId = "span-id-1", sessionId = "session-id-1")
        val spanToNotDelete =
            TestData.getSpanEntity(spanId = "span-id-2", sessionId = "session-id-2")
        database.insertSpan(spanToDelete)
        database.insertSpan(spanToNotDelete)

        // when
        database.deleteSessions(listOf("session-id-1"))

        // then
        database.readableDatabase.query(
            SpansTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use {
            assertEquals(1, it.count)
            it.moveToFirst()
            assertEquals("span-id-2", it.getString(it.getColumnIndex(SpansTable.COL_SPAN_ID)))
        }
    }

    @Test
    fun `getEventsForSessions returns all event Ids for given session Ids`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-2")
        val event3 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-3")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-id-2"))
        database.insertSession(TestData.getSessionEntity(id = "session-id-3"))
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertEvent(event3)

        // when
        val events = database.getEventsForSessions(listOf("session-id-1", "session-id-2"))

        // then
        assertEquals(2, events.size)
    }

    @Test
    fun `getAttachmentsForEvents returns all attachment Ids for given event Ids, ignores events which do not have attachments`() {
        // given
        val event1 = TestData.getEventEntity(
            eventId = "event-id-1",
            sessionId = "session-id",
            attachmentEntities = listOf(
                TestData.getAttachmentEntity(id = "attachment-id-1"),
                TestData.getAttachmentEntity(id = "attachment-id-2"),
            ),
        )
        val event2 = TestData.getEventEntity(
            eventId = "event-id-2",
            sessionId = "session-id",
            attachmentEntities = listOf(
                TestData.getAttachmentEntity(id = "attachment-id-3"),
                TestData.getAttachmentEntity(id = "attachment-id-4"),
            ),
        )
        val eventWithoutAttachment = TestData.getEventEntity(
            eventId = "event-id-3",
            sessionId = "session-id",
            attachmentEntities = emptyList(),
        )
        val event4 = TestData.getEventEntity(
            eventId = "event-id-4",
            sessionId = "session-id",
            attachmentEntities = listOf(
                TestData.getAttachmentEntity(id = "attachment-id-5"),
                TestData.getAttachmentEntity(id = "attachment-id-6"),
            ),
        )
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertEvent(eventWithoutAttachment)
        database.insertEvent(event4)

        // when
        val attachments =
            database.getAttachmentsForEvents(listOf("event-id-1", "event-id-2", "event-id-3"))

        // then
        assertEquals(4, attachments.size)
    }

    @Test
    fun `getEventsCount returns count of all events in events table`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-2")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-id-2"))
        database.insertEvent(event1)
        database.insertEvent(event2)

        // when
        val count = database.getEventsCount()

        // then
        assertEquals(2, count)
    }

    @Test
    fun `getEventsCount returns 0 if no events in events table`() {
        val count = database.getEventsCount()
        assertEquals(0, count)
    }

    @Test
    fun `insertSpan inserts span and returns success`() {
        database.insertSession(TestData.getSessionEntity(id = "session-id"))
        val result = database.insertSpan(
            TestData.getSpanEntity(sessionId = "session-id"),
        )
        assertTrue(result)
    }

    @Test
    fun `deleteBatch deletes all events, attachments and spans for the batch`() {
        // given
        val event1 = TestData.getEventEntity(eventId = "event-id-1", sessionId = "session-id-1")
        val event2 = TestData.getEventEntity(eventId = "event-id-2", sessionId = "session-id-1")
        val eventWithDifferentSession =
            TestData.getEventEntity(eventId = "event-id-3", sessionId = "session-id-2")
        val eventNotInDb =
            TestData.getEventEntity(eventId = "event-id-4", sessionId = "session-id-1")
        val attachment = TestData.getAttachmentEntity("attachment-id")
        val eventWithAttachment = TestData.getEventEntity(
            eventId = "event-id-4",
            sessionId = "session-id-1",
            attachmentEntities = listOf(attachment),
        )
        val span1 = TestData.getSpanEntity(spanId = "span-1", sessionId = "session-id-1")
        val span2 = TestData.getSpanEntity(spanId = "span-2", sessionId = "session-id-1")
        val spanWithDifferentSession =
            TestData.getSpanEntity(spanId = "span-3", sessionId = "session-id-2")
        val spanNotInDb = TestData.getSpanEntity(spanId = "span-4", sessionId = "session-id-1")
        database.insertSession(TestData.getSessionEntity(id = "session-id-1"))
        database.insertSession(TestData.getSessionEntity(id = "session-id-2"))
        database.insertEvent(event1)
        database.insertEvent(event2)
        database.insertEvent(eventWithDifferentSession)
        database.insertEvent(eventWithAttachment)
        database.insertSpan(span1)
        database.insertSpan(span2)
        database.insertSpan(spanWithDifferentSession)
        val eventIds = listOf(
            event1.id,
            event2.id,
            eventWithDifferentSession.id,
            eventWithAttachment.id,
        )
        val spanIds = listOf(
            span1.spanId,
            span2.spanId,
            spanWithDifferentSession.spanId,
        )
        database.insertBatch(
            BatchEntity(
                "batch-id",
                eventIds = eventIds,
                createdAt = 98765432L,
                spanIds = spanIds,
            ),
        )

        // when
        database.deleteBatch(
            batchId = "batch-id",
            eventIds = eventIds + eventNotInDb.id,
            spanIds = spanIds + spanNotInDb.spanId,
        )

        // then
        queryAllEvents(database.writableDatabase).use {
            assertEquals(0, it.count)
        }
        queryAllSpans(database.writableDatabase).use {
            assertEquals(0, it.count)
        }
        queryAllAttachments(database.writableDatabase).use {
            assertEquals(0, it.count)
        }
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

    private fun queryAllSpans(db: SQLiteDatabase): Cursor {
        return db.query(
            SpansTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        )
    }

    private fun queryAllAttachments(db: SQLiteDatabase): Cursor {
        return db.query(
            AttachmentTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        )
    }

    private fun queryAllBatches(): Cursor {
        val db = database.writableDatabase
        return db.query(
            BatchesTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        )
    }

    private fun queryAllEventBatches(): Cursor {
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

    private fun queryAllSpanBatches(): Cursor {
        val db = database.writableDatabase
        return db.query(
            SpansBatchTable.TABLE_NAME,
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
            cursor.getString(cursor.getColumnIndex(EventTable.COL_TIMESTAMP)),
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
            attachmentEntity.name,
            cursor.getString(cursor.getColumnIndex(AttachmentTable.COL_NAME)),
        )
        assertEquals(
            event.timestamp,
            cursor.getString(cursor.getColumnIndex(AttachmentTable.COL_TIMESTAMP)),
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

    private fun assertBatchInCursor(
        @Suppress("SameParameterValue") batchId: String,
        cursor: Cursor,
    ) {
        assertEquals(
            batchId,
            cursor.getString(cursor.getColumnIndex(EventsBatchTable.COL_BATCH_ID)),
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
