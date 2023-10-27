package sh.measure.android.session

import androidx.concurrent.futures.ResolvableFuture
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToJsonElement
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeResourceFactory
import sh.measure.android.fakes.FakeTransport
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.Storage
import sh.measure.android.utils.iso8601Timestamp

class SessionControllerTest {
    private val logger = NoopLogger()
    private val transport = FakeTransport()
    private val sessionReportGenerator = mock<SessionReportGenerator>()
    private val storage = mock<Storage>()
    private val sessionProvider = mock<SessionProvider>()

    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private lateinit var sessionController : SessionController

    @Before
    fun setUp() {
        sessionController = SessionControllerImpl(
            logger, sessionProvider, storage, transport, executorService, sessionReportGenerator,
        )
    }

    @Test
    fun `SessionController creates session and stores it`() {
        val sessionId = "session-id"
        val session = Session(
            id = sessionId,
            startTime = 0,
            resource = FakeResourceFactory().resource,
            pid = 0,
        )
        `when`(sessionProvider.session).thenReturn(session)

        // When
        sessionController.createSession()

        // Then
        verify(sessionProvider).createSession()
        verify(storage).storeSession(session)
    }

    @Test
    fun `SessionController when sessions are available, syncs and deletes them on success, ignoring active session`() {
        // create sessions
        val session1 = createFakeSession("session-id-1")
        val session2 = createFakeSession("session-id-2")
        val activeSession = createFakeSession("active-session-id")

        // setup mocks
        `when`(storage.getAllSessions()).thenReturn(listOf(session1, session2, activeSession))
        `when`(sessionProvider.session).thenReturn(activeSession)
        `when`(sessionReportGenerator.getSessionReport(session1)).thenReturn(
            session1.toSessionReport()
        )
        `when`(sessionReportGenerator.getSessionReport(session2)).thenReturn(
            session2.toSessionReport()
        )
        transport.returnSuccess = true

        // When
        sessionController.syncAllSessions()

        // Then
        verify(sessionReportGenerator).getSessionReport(session1)
        verify(sessionReportGenerator).getSessionReport(session2)
        verify(sessionReportGenerator, never()).getSessionReport(activeSession)
        verify(storage).deleteSession(session1.id)
        verify(storage).deleteSession(session2.id)
    }

    @Test
    fun `SessionController when sessions are available, then syncs sessions and but does not delete them on error`() {
        // create sessions
        val session1 = createFakeSession("session-id-1")
        val session2 = createFakeSession("session-id-2")
        val activeSession = createFakeSession("active-session-id")

        // setup mocks
        `when`(storage.getAllSessions()).thenReturn(listOf(session1, session2, activeSession))
        `when`(sessionProvider.session).thenReturn(activeSession)
        `when`(sessionReportGenerator.getSessionReport(session1)).thenReturn(
            session1.toSessionReport()
        )
        `when`(sessionReportGenerator.getSessionReport(session2)).thenReturn(
            session2.toSessionReport()
        )
        transport.returnSuccess = false

        // When
        sessionController.syncAllSessions()

        // Then
        verify(sessionReportGenerator).getSessionReport(session1)
        verify(sessionReportGenerator).getSessionReport(session2)
        verify(sessionReportGenerator, never()).getSessionReport(activeSession)
        verify(storage, never()).deleteSession(session1.id)
        verify(storage, never()).deleteSession(session2.id)
    }

    @Test
    fun `SessionController delegates to storage to store event for active session`() {
        val event = Event(
            type = EventType.STRING,
            timestamp = 0L.iso8601Timestamp(),
            data = Json.encodeToJsonElement("test")
        )
        // setup mocks
        val activeSession = createFakeSession("session-id")
        `when`(sessionProvider.session).thenReturn(activeSession)

        // When
        sessionController.storeEvent(event)

        verify(storage).storeEvent(event, activeSession.id)
    }

    private fun createFakeSession(sessionId: String, startTime: Long = 0): Session {
        return Session(
            id = sessionId,
            startTime = startTime,
            resource = FakeResourceFactory().resource,
            pid = 0,
        )
    }

    private fun Session.toSessionReport(): SessionReport {
        return SessionReport(
            session_id = id,
            timestamp = startTime.iso8601Timestamp(),
            eventsFile = mock(),
            resource = Json.encodeToJsonElement(FakeResourceFactory().resource)
        )
    }
}
