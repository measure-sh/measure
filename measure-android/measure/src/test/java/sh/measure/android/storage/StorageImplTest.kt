package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.fakes.FakeResourceFactory
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.session.Resource
import sh.measure.android.session.Session
import sh.measure.android.session.SessionReport
import sh.measure.android.session.SignalReport
import sh.measure.android.session.events
import sh.measure.android.session.iso8601Timestamp
import sh.measure.android.storage.SessionContract.SessionTable
import sh.measure.android.storage.SessionContract.SignalsTable
import sh.measure.android.tracker.EventType
import sh.measure.android.tracker.SignalType

@RunWith(AndroidJUnit4::class)
class StorageImplTest {

    private val db =
        SqliteDbHelper(logger = NoopLogger(), context = RuntimeEnvironment.getApplication())

    private val storage: Storage = StorageImpl(logger = NoopLogger(), db = db)

    @Test
    fun `inserts a session into sessions table with synced & crashed default to false`() {
        val session =
            Session(id = "id", startTime = 9876543210, resource = FakeResourceFactory().create())
        // When
        storage.saveSession(session)

        // Then
        db.writableDatabase.let {
            it.rawQuery("SELECT * FROM ${SessionTable.TABLE_NAME}", null)
                .use { cursor ->
                    assertTrue(cursor.moveToFirst())
                    assertEquals(
                        session.id,
                        cursor.getString(cursor.getColumnIndex(SessionTable.COLUMN_SESSION_ID))
                    )
                    assertEquals(
                        session.startTime,
                        cursor.getLong(cursor.getColumnIndex(SessionTable.COLUMN_SESSION_START_TIME))
                    )
                    assertEquals(
                        Json.encodeToString(Resource.serializer(), session.resource),
                        cursor.getString(cursor.getColumnIndex(SessionTable.COLUMN_RESOURCE))
                    )
                    assertEquals(
                        false,
                        cursor.getInt(cursor.getColumnIndex(SessionTable.COLUMN_CRASHED)) == 1
                    )
                    assertEquals(
                        false, cursor.getInt(cursor.getColumnIndex(SessionTable.COLUMN_SYNCED)) == 1
                    )
                }
        }
    }

    @Test
    fun `deletes session from sessions table`() {
        // Given
        val session =
            Session(id = "id", startTime = 9876543210, resource = FakeResourceFactory().create())
        storage.saveSession(session)

        // When
        storage.deleteSession(session.id)

        // Then
        db.writableDatabase.let {
            it.rawQuery("SELECT * FROM ${SessionTable.TABLE_NAME}", null)
                .use { cursor ->
                    assertFalse(cursor.moveToFirst())
                }
        }
    }

    @Test
    fun `saves unhandled exception and marks the session as crashed`() {
        // Given
        val session =
            Session(id = "id", startTime = 9876543210, resource = FakeResourceFactory().create())
        val signal = Signal(
            sessionId = session.id,
            timestamp = 9876543210.iso8601Timestamp(),
            signalType = SignalType.EVENT,
            dataType = EventType.EXCEPTION,
            data = Json.encodeToString(
                MeasureException.serializer(), ExceptionFactory.createMeasureException(
                    RuntimeException("Test exception"),
                    handled = false,
                    9876543210,
                    Thread.currentThread()
                )
            )
        )
        storage.saveSession(session)

        // When
        storage.saveUnhandledException(signal)

        // Verify session is marked as crashed
        db.writableDatabase.let {
            it.rawQuery("SELECT * FROM ${SessionTable.TABLE_NAME}", null)
                .use { cursor ->
                    assertTrue(cursor.moveToFirst())
                    assertEquals(
                        true, cursor.getInt(cursor.getColumnIndex(SessionTable.COLUMN_CRASHED)) == 1
                    )
                }
        }
        // Verify signal is saved
        db.writableDatabase.let {
            it.rawQuery("SELECT * FROM ${SignalsTable.TABLE_NAME}", null)
                .use { cursor ->
                    assertTrue(cursor.moveToFirst())
                    assertEquals(
                        signal.sessionId,
                        cursor.getString(cursor.getColumnIndex(SignalsTable.COLUMN_SESSION_ID))
                    )
                    assertEquals(
                        signal.timestamp,
                        cursor.getString(cursor.getColumnIndex(SignalsTable.COLUMN_TIMESTAMP))
                    )
                    assertEquals(
                        signal.signalType,
                        cursor.getString(cursor.getColumnIndex(SignalsTable.COLUMN_SIGNAL_TYPE))
                    )
                    assertEquals(
                        signal.dataType,
                        cursor.getString(cursor.getColumnIndex(SignalsTable.COLUMN_DATA_TYPE))
                    )
                    assertEquals(
                        signal.data,
                        cursor.getString(cursor.getColumnIndex(SignalsTable.COLUMN_DATA))
                    )
                }
        }
    }

    @Test
    fun `returns session report from session & signals table for a given session ID`() {
        // Given
        val session = Session(
            id = "id", startTime = 9876543210, resource = FakeResourceFactory().create()
        )
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()
        val signal = ExceptionFactory.createMeasureException(
            exception, handled = true, 1231231, thread
        ).toSignal("id")
        prePopulateSession(session)
        prePopulateSignal(signal)

        // When
        val result: SessionReport? = storage.getSessionReport(signal.sessionId)
        assertNotNull(result)
        val sessionReport = result!!

        // Then
        assertEquals(session.id, sessionReport.session_id)
        assertEquals(listOf(signal.toSignalReport()).events(), sessionReport.events)
        assertEquals(
            Json.encodeToJsonElement(Resource.serializer(), session.resource),
            sessionReport.resource
        )
        assertEquals(session.startTime.iso8601Timestamp(), sessionReport.timestamp)
    }

    @Test
    fun `clears the session and it's signals for given session ID`() {
        // Given
        val signal = Signal(
            sessionId = "id",
            timestamp = 9876543210.iso8601Timestamp(),
            signalType = "entryType",
            dataType = "dataType",
            data = "data"
        )
        val session = Session(
            id = signal.sessionId, startTime = 9876543210, resource = FakeResourceFactory().create()
        )
        prePopulateSignal(signal)
        prePopulateSession(session)

        // When
        storage.deleteSessionAndSignals(signal.sessionId)

        // Then
        db.writableDatabase.let {
            it.rawQuery("SELECT * FROM ${SignalsTable.TABLE_NAME}", null)
                .use { cursor ->
                    assertFalse(cursor.moveToFirst())
                }
        }
        db.writableDatabase.let {
            it.rawQuery("SELECT * FROM ${SessionTable.TABLE_NAME}", null)
                .use { cursor ->
                    assertFalse(cursor.moveToFirst())
                }
        }
    }

    @Test
    fun `deletes session without crashes, except the current session`() {
        // Given
        val session1 = Session(
            id = "id1", startTime = 9876543210, resource = FakeResourceFactory().create()
        )
        val activeSession = Session(
            id = "id2", startTime = 9876543290, resource = FakeResourceFactory().create()
        )
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()
        val signal1 = ExceptionFactory.createMeasureException(
            exception, handled = true, 1231231, thread
        ).toSignal("id1")
        val signal2 = ExceptionFactory.createMeasureException(
            exception, handled = true, 1231231, thread
        ).toSignal("id2")
        prePopulateSession(session1)
        prePopulateSession(activeSession)
        prePopulateSignal(signal1)
        prePopulateSignal(signal2)

        // When
        storage.deleteSessionsWithoutCrash(activeSession.id)

        // Verify session1 is deleted
        db.writableDatabase.let {
            it.rawQuery(
                "SELECT * FROM ${SessionTable.TABLE_NAME} WHERE ${SessionTable.COLUMN_SESSION_ID} = ?",
                arrayOf(session1.id)
            ).use { cursor ->
                assertFalse(cursor.moveToFirst())
            }
        }

        // Verify all signals for session1 are deleted
        db.writableDatabase.let {
            it.rawQuery(
                "SELECT * FROM ${SignalsTable.TABLE_NAME} WHERE ${SignalsTable.COLUMN_SESSION_ID} = ?",
                arrayOf(session1.id)
            ).use { cursor ->
                assertFalse(cursor.moveToFirst())
            }
        }
        // Verify activeSession is not deleted
        db.writableDatabase.let {
            it.rawQuery(
                "SELECT * FROM ${SessionTable.TABLE_NAME} WHERE ${SessionTable.COLUMN_SESSION_ID} = ?",
                arrayOf(activeSession.id)
            ).use { cursor ->
                assertTrue(cursor.moveToFirst())
            }
        }
        // Verify signals for activeSession are not deleted
        db.writableDatabase.let {
            it.rawQuery(
                "SELECT * FROM ${SignalsTable.TABLE_NAME} WHERE ${SignalsTable.COLUMN_SESSION_ID} = ?",
                arrayOf(activeSession.id)
            ).use { cursor ->
                assertTrue(cursor.moveToFirst())
            }
        }
    }

    @Test
    fun `returns all crashed sessions that are not synced yet`() {
        // Given
        val session1 = Session(
            id = "id1", startTime = 9876543210, resource = FakeResourceFactory().create()
        )
        val session2 = Session(
            id = "id2", startTime = 9876543290, resource = FakeResourceFactory().create()
        )
        val session3 = Session(
            id = "id3", startTime = 9876543299, resource = FakeResourceFactory().create()
        )
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()
        val signal1 = ExceptionFactory.createMeasureException(
            exception, handled = true, 1231231, thread
        ).toSignal("id1")
        val signal2 = ExceptionFactory.createMeasureException(
            exception, handled = true, 1231231, thread
        ).toSignal("id2")
        val signal3 = ExceptionFactory.createMeasureException(
            exception, handled = true, 1231231, thread
        ).toSignal("id3")
        prePopulateSession(session1, crashed = true)
        prePopulateSession(session2, crashed = true)
        prePopulateSession(session3, crashed = false)
        prePopulateSignal(signal1)
        prePopulateSignal(signal2)
        prePopulateSignal(signal3)

        // When
        val result = storage.getUnsyncedSessions()
        assertNotNull(result)

        // Then
        assertEquals(2, result.size)
        assertEquals(session1.id, result[0])
        assertEquals(session2.id, result[1])
    }

    private fun prePopulateSignal(signal: Signal) {
        val contentValues = signal.toContentValues()
        db.writableDatabase.use {
            it.insert(
                SignalsTable.TABLE_NAME, null, contentValues
            )
        }
    }

    private fun prePopulateSession(session: Session, crashed: Boolean = false) {
        val contentValues = session.toContentValues(crashed = crashed)
        db.writableDatabase.use {
            it.insert(
                SessionTable.TABLE_NAME, null, contentValues
            )
        }
    }

    private fun Signal.toSignalReport(): SignalReport {
        return SignalReport(
            timestamp = timestamp,
            signalType = signalType,
            dataType = dataType,
            data = Json.parseToJsonElement(data)
        )
    }
}