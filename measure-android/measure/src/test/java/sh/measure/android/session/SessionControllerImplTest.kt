package sh.measure.android.session

import android.os.Handler
import androidx.concurrent.futures.ResolvableFuture
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToJsonElement
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.mockito.ArgumentCaptor
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
import sh.measure.android.storage.UnsyncedSession
import sh.measure.android.utils.iso8601Timestamp
import java.util.concurrent.CountDownLatch

class SessionControllerImplTest {

    private val logger = NoopLogger()
    private val transport = FakeTransport()
    private val sessionReportGenerator = mock<SessionReportGenerator>()
    private val storage = mock<Storage>()
    private val handler = mock<Handler>()
    private val sessionProvider = mock<SessionProvider>()

    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val sessionController = SessionControllerImpl(
        logger,
        sessionProvider,
        storage,
        transport,
        executorService,
        sessionReportGenerator,
        handler
    )

    @Before
    fun setUp() {
        setupHandlerMock()
    }

    @Test
    fun `SessionController when session is created successfully, returns the created session ID`() {
        val sessionId = "session-id"
        val session = Session(
            id = sessionId,
            startTime = 0,
            resource = FakeResourceFactory().resource,
            pid = 0,
            synced = false
        )
        `when`(sessionProvider.session).thenReturn(session)
        var returnedSessionId: String? = null

        // When
        val countDownLatch = CountDownLatch(1)
        sessionController.createSession(
            onSuccess = { id ->
                returnedSessionId = id
                countDownLatch.countDown()
            },
            onError = { },
        )

        // Then
        countDownLatch.await()
        verify(sessionProvider).createSession()
        verify(storage).createSession(session)
        verify(storage).createResource(session.resource, session.id)
        Assert.assertEquals(sessionId, returnedSessionId)
    }

    @Test
    fun `SessionController when session creation fails, invokes onError callback`() {
        val session = createFakeSession("session-id")
        `when`(sessionProvider.session).thenReturn(session)
        `when`(storage.createSession(session)).thenThrow(RuntimeException())

        // When
        val countDownLatch = CountDownLatch(1)
        sessionController.createSession(
            onSuccess = { },
            onError = {
                countDownLatch.countDown()
            },
        )

        // Then
        countDownLatch.await()
        Assert.assertEquals(0, countDownLatch.count)
    }

    @Test
    fun `SessionController delegates to storage to delete unsynced sessions`() {
        sessionController.deleteSyncedSessions()
        verify(storage).deleteSyncedSessions()
    }

    @Test
    fun `SessionController when unsynced sessions are available, then syncs and deletes them on success, ignoring active session`() {
        // create sessions
        val session1 = createFakeSession("session-id-1")
        val session2 = createFakeSession("session-id-2")
        val activeSession = createFakeSession("active-session-id")
        val unsyncedSession1 = session1.unsyncedSession()
        val unsyncedSession2 = session2.unsyncedSession()
        val activeUnsyncedSession = activeSession.unsyncedSession()
        val unsyncedSessions = listOf(unsyncedSession1, unsyncedSession2, activeUnsyncedSession)

        // setup mocks
        `when`(storage.getUnsyncedSessions()).thenReturn(unsyncedSessions)
        `when`(sessionProvider.session).thenReturn(activeSession)
        `when`(sessionReportGenerator.getSessionReport(unsyncedSession1)).thenReturn(
            unsyncedSession1.sessionReport()
        )
        `when`(sessionReportGenerator.getSessionReport(unsyncedSession2)).thenReturn(
            unsyncedSession2.sessionReport()
        )
        transport.returnSuccess = true

        // When
        sessionController.syncSessions()

        // Then
        verify(sessionReportGenerator).getSessionReport(unsyncedSession1)
        verify(sessionReportGenerator).getSessionReport(unsyncedSession2)
        verify(sessionReportGenerator, never()).getSessionReport(activeUnsyncedSession)
        verify(storage).deleteSession(unsyncedSession1.id)
        verify(storage).deleteSession(unsyncedSession2.id)
    }

    @Test
    fun `SessionController when unsynced sessions are available, then syncs sessions and but does not delete them on error`() {
        // create sessions
        val session1 = createFakeSession("session-id-1")
        val session2 = createFakeSession("session-id-2")
        val activeSession = createFakeSession("active-session-id")
        val unsyncedSession1 = session1.unsyncedSession()
        val unsyncedSession2 = session2.unsyncedSession()
        val activeUnsyncedSession = activeSession.unsyncedSession()
        val unsyncedSessions = listOf(unsyncedSession1, unsyncedSession2, activeUnsyncedSession)

        // setup mocks
        `when`(storage.getUnsyncedSessions()).thenReturn(unsyncedSessions)
        `when`(sessionProvider.session).thenReturn(activeSession)
        `when`(sessionReportGenerator.getSessionReport(unsyncedSession1)).thenReturn(
            unsyncedSession1.sessionReport()
        )
        `when`(sessionReportGenerator.getSessionReport(unsyncedSession2)).thenReturn(
            unsyncedSession2.sessionReport()
        )
        transport.returnSuccess = false

        // When
        sessionController.syncSessions()

        // Then
        verify(sessionReportGenerator).getSessionReport(unsyncedSession1)
        verify(sessionReportGenerator).getSessionReport(unsyncedSession2)
        verify(sessionReportGenerator, never()).getSessionReport(activeUnsyncedSession)
        verify(storage, never()).deleteSession(unsyncedSession1.id)
        verify(storage, never()).deleteSession(unsyncedSession2.id)
    }

    @Test
    fun `SessionController syncs active session and deletes it on success`() {
        // create active session
        val activeSession = createFakeSession("active-session-id")
        val activeUnsyncedSession = activeSession.unsyncedSession()

        // setup mocks
        `when`(sessionProvider.session).thenReturn(activeSession)
        `when`(sessionReportGenerator.getSessionReport(activeUnsyncedSession)).thenReturn(
            activeUnsyncedSession.sessionReport()
        )
        transport.returnSuccess = true

        // When
        sessionController.syncActiveSession()

        // Then
        verify(sessionReportGenerator).getSessionReport(activeUnsyncedSession)
        verify(storage).deleteSession(activeSession.id)
    }

    @Test
    fun `SessionController syncs active session but does not delete it on error`() {
        // create active session
        val activeSession = createFakeSession("active-session-id")
        val activeUnsyncedSession = activeSession.unsyncedSession()

        // setup mocks
        `when`(sessionProvider.session).thenReturn(activeSession)
        `when`(sessionReportGenerator.getSessionReport(activeUnsyncedSession)).thenReturn(
            activeUnsyncedSession.sessionReport()
        )
        transport.returnSuccess = false

        // When
        sessionController.syncActiveSession()

        // Then
        verify(sessionReportGenerator).getSessionReport(activeUnsyncedSession)
        verify(storage, never()).deleteSession(activeSession.id)
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
            synced = false
        )
    }

    private fun Session.unsyncedSession(): UnsyncedSession {
        return UnsyncedSession(id, startTime.iso8601Timestamp(), pid)
    }

    private fun UnsyncedSession.sessionReport(): SessionReport? {
        return SessionReport(
            session_id = id, timestamp = startTime, eventsFile = mock(), resourceFile = mock()
        )
    }

    // Run the handler's posted runnable immediately
    private fun setupHandlerMock() {
        val captor = ArgumentCaptor.forClass(Runnable::class.java)
        `when`(handler.post(captor.capture())).thenAnswer {
            captor.value.run()
            true
        }
    }
}
