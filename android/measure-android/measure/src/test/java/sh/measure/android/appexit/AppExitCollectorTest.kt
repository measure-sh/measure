package sh.measure.android.appexit

import android.app.ApplicationExitInfo
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.FakeAppExitProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
import sh.measure.android.storage.PendingAnr
import sh.measure.android.storage.SessionRecord
import sh.measure.android.utils.iso8601Timestamp
import java.io.File

class AppExitCollectorTest {
    private val appExitProvider = FakeAppExitProvider()
    private val signalProcessor = mock<SignalProcessor>()
    private val sessionManager = FakeSessionManager()
    private val database = mock<Database>()
    private val fileStorage = mock<FileStorage>()
    private val processInfo = FakeProcessInfoProvider(id = 100)

    private val appExitCollector = AppExitCollector(
        logger = NoopLogger(),
        appExitProvider = appExitProvider,
        signalProcessor = signalProcessor,
        sessionManager = sessionManager,
        database = database,
        fileStorage = fileStorage,
        processInfo = processInfo,
    )

    @Test
    fun `given session is available for given pid, tracks app exit event`() {
        // Given
        val appExit = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val pid = 1
        val pidToAppExit = pid to appExit
        val appExits = mapOf(pidToAppExit)
        appExitProvider.appExits = appExits
        val session = getSession(pid)
        sessionManager.appExitSessions[pid] = session

        // When
        appExitCollector.collect()

        // Then
        verify(signalProcessor).trackAppExit(
            eq(appExit),
            eq(appExit.app_exit_time_ms),
            eq(EventType.APP_EXIT),
            threadName = any(),
            sessionId = eq(session.id),
            sessionStartTime = eq(session.createdAt),
            appVersion = eq("1.0.0"),
            appBuild = eq("1000"),
            isSampled = any(),
        )
        assertEquals(
            session.id to appExit.app_exit_time_ms,
            sessionManager.markedAnrSessions.single(),
        )
    }

    @Test
    fun `given multiple sessions are available, tracks app exit event for each of them`() {
        // Given
        val appExit1 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val session1 =
            getSession(sessionId = "session-1", pid = 1, appVersion = "1.1.1", appBuild = "111")
        val appExit2 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val session2 =
            getSession(sessionId = "session-2", pid = 2, appVersion = "1.1.2", appBuild = "112")

        appExitProvider.appExits = mapOf(1 to appExit1, 2 to appExit2)
        sessionManager.appExitSessions[1] = session1
        sessionManager.appExitSessions[2] = session2

        // When
        appExitCollector.collect()

        // Then
        verify(signalProcessor).trackAppExit(
            eq(appExit1),
            eq(appExit1.app_exit_time_ms),
            eq(EventType.APP_EXIT),
            threadName = any(),
            sessionId = eq(session1.id),
            sessionStartTime = eq(session1.createdAt),
            appVersion = eq(session1.appVersion),
            appBuild = eq(session1.appBuild),
            isSampled = any(),
        )
        verify(signalProcessor).trackAppExit(
            eq(appExit2),
            eq(appExit2.app_exit_time_ms),
            eq(EventType.APP_EXIT),
            threadName = any(),
            sessionId = eq(session2.id),
            sessionStartTime = eq(session2.createdAt),
            appVersion = eq(session2.appVersion),
            appBuild = eq(session2.appBuild),
            isSampled = any(),
        )
    }

    @Test
    fun `given no session is available for given pid, does not track app exit event`() {
        // Given
        val appExit = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        appExitProvider.appExits = mapOf(1 to appExit)

        // When
        appExitCollector.collect()

        // Then
        verifyNoAppExitTracked()
    }

    @Test
    fun `given app exit has no trace, does not track app exit event`() {
        // Given
        val appExit = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR, trace = null)
        val pid = 1
        appExitProvider.appExits = mapOf(pid to appExit)
        sessionManager.appExitSessions[pid] = getSession(pid)

        // When
        appExitCollector.collect()

        // Then
        verifyNoAppExitTracked()
    }

    @Test
    fun `marks sessions as app exit tracked after collection`() {
        // Given
        val appExit1 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val session1 = getSession(sessionId = "session-1", pid = 1, createdAt = 1000)
        val appExit2 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val session2 = getSession(sessionId = "session-2", pid = 2, createdAt = 2000)

        appExitProvider.appExits = mapOf(1 to appExit1, 2 to appExit2)
        sessionManager.appExitSessions[1] = session1
        sessionManager.appExitSessions[2] = session2

        // When
        appExitCollector.collect()

        // Then
        assertEquals(1, sessionManager.appExitTrackedCount)
    }

    @Test
    fun `given a pending ANR matches an ANR exit, enriches it instead of tracking app exit`() {
        // Given
        val exitTime = 987654321L
        val appExit = TestData.getAppExit(
            reasonId = ApplicationExitInfo.REASON_ANR,
            subject = "Input dispatching timed out",
            threadDump = "\"main\" prio=5 tid=1 Blocked\n  at com.example.App.block(App.kt:10)",
            appExitTimeMs = exitTime,
        )
        val pid = 1
        appExitProvider.appExits = mapOf(pid to appExit)
        sessionManager.appExitSessions[pid] = getSession(pid)
        val file = writeAnrEventFile(TestData.getExceptionData())
        val pendingAnr = getPendingAnr(
            eventId = "event-1",
            timestamp = (exitTime - 1000).iso8601Timestamp(),
            filePath = file.path,
            pid = pid,
        )
        whenever(database.getPendingAnrs()).thenReturn(listOf(pendingAnr))
        whenever(fileStorage.getFile(file.path)).thenReturn(file)

        // When
        appExitCollector.collect()

        // Then
        val enriched =
            jsonSerializer.decodeFromString(ExceptionData.serializer(), file.readText())
        assertEquals(appExit.threadDump, enriched.thread_dump)
        assertEquals(appExit.subject, enriched.subject)
        verifyNoAppExitTracked()
        verify(database).movePendingAnrToEvents("event-1")
    }

    @Test
    fun `given multiple pending ANRs for a pid, enriches the latest`() {
        // Given
        val exitTime = 987654321L
        val appExit = TestData.getAppExit(
            reasonId = ApplicationExitInfo.REASON_ANR,
            subject = "Input dispatching timed out",
            threadDump = "\"main\" prio=5 tid=1 Blocked\n  at com.example.App.block(App.kt:10)",
            appExitTimeMs = exitTime,
        )
        val pid = 1
        appExitProvider.appExits = mapOf(pid to appExit)
        val earlierFile = writeAnrEventFile(TestData.getExceptionData())
        val latestFile = writeAnrEventFile(TestData.getExceptionData())
        val earlier = getPendingAnr(
            eventId = "event-1",
            timestamp = (exitTime - 2000).iso8601Timestamp(),
            filePath = earlierFile.path,
            pid = pid,
        )
        val latest = getPendingAnr(
            eventId = "event-2",
            timestamp = (exitTime - 1000).iso8601Timestamp(),
            filePath = latestFile.path,
            pid = pid,
        )
        whenever(database.getPendingAnrs()).thenReturn(listOf(earlier, latest))
        whenever(fileStorage.getFile(latestFile.path)).thenReturn(latestFile)

        // When
        appExitCollector.collect()

        // Then
        val enriched =
            jsonSerializer.decodeFromString(ExceptionData.serializer(), latestFile.readText())
        assertEquals(appExit.threadDump, enriched.thread_dump)
        val unchanged =
            jsonSerializer.decodeFromString(ExceptionData.serializer(), earlierFile.readText())
        assertEquals(null, unchanged.thread_dump)
        verify(database).movePendingAnrToEvents("event-1")
        verify(database).movePendingAnrToEvents("event-2")
    }

    /**
     * A held ANR is matched to an exit by pid alone, so an exit whose
     * pid the live process has been given cannot be told apart from the
     * dead one. Enriching then would attach a dead process's dump to an
     * ANR of the running one.
     */
    @Test
    fun `given the exit pid belongs to the current process, does not enrich`() {
        // Given
        val appExit = TestData.getAppExit(
            reasonId = ApplicationExitInfo.REASON_ANR,
            subject = "Input dispatching timed out",
            threadDump = "\"main\" prio=5 tid=1 Blocked\n  at com.example.App.block(App.kt:10)",
        )
        val pid = processInfo.getPid()
        appExitProvider.appExits = mapOf(pid to appExit)
        sessionManager.appExitSessions[pid] = getSession(pid)
        val file = writeAnrEventFile(TestData.getExceptionData())
        val pendingAnr = getPendingAnr(eventId = "event-1", filePath = file.path, pid = pid)
        whenever(database.getPendingAnrs()).thenReturn(listOf(pendingAnr))
        whenever(fileStorage.getFile(file.path)).thenReturn(file)

        // When
        appExitCollector.collect()

        // Then
        val unchanged =
            jsonSerializer.decodeFromString(ExceptionData.serializer(), file.readText())
        assertEquals(null, unchanged.thread_dump)
        verify(database, never()).movePendingAnrToEvents("event-1")
    }

    @Test
    fun `given exit is not an ANR, moves held ANR into events unenriched`() {
        // Given
        val appExit = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_CRASH)
        val pid = 1
        appExitProvider.appExits = mapOf(pid to appExit)
        val pendingAnr = getPendingAnr(eventId = "event-1", pid = pid)
        whenever(database.getPendingAnrs()).thenReturn(listOf(pendingAnr))

        // When
        appExitCollector.collect()

        // Then
        verifyNoAppExitTracked()
        verify(database).movePendingAnrToEvents("event-1")
    }

    @Test
    fun `moves pending ANRs of dead processes into events, keeps the current process's`() {
        // Given
        appExitProvider.appExits = emptyMap()
        val deadProcessAnr = getPendingAnr(eventId = "event-1", pid = 1)
        val currentProcessAnr = getPendingAnr(eventId = "event-2", pid = processInfo.getPid())
        whenever(database.getPendingAnrs()).thenReturn(listOf(deadProcessAnr, currentProcessAnr))

        // When
        appExitCollector.collect()

        // Then
        verify(database).movePendingAnrToEvents("event-1")
        verify(database, never()).movePendingAnrToEvents("event-2")
    }

    private fun verifyNoAppExitTracked() {
        verify(signalProcessor, never()).trackAppExit(
            any(),
            any(),
            any(),
            threadName = any(),
            sessionId = any(),
            sessionStartTime = any(),
            appVersion = any(),
            appBuild = any(),
            isSampled = any(),
        )
    }

    private fun writeAnrEventFile(exceptionData: ExceptionData): File {
        val file = File.createTempFile("anr-event", null)
        file.deleteOnExit()
        file.writeText(jsonSerializer.encodeToString(ExceptionData.serializer(), exceptionData))
        return file
    }

    private fun getPendingAnr(
        eventId: String,
        pid: Int,
        timestamp: String = 0L.iso8601Timestamp(),
        filePath: String? = null,
    ) = PendingAnr(
        eventId = eventId,
        sessionId = "session-id-1",
        timestamp = timestamp,
        filePath = filePath,
        pid = pid,
    )

    private fun getSession(
        pid: Int,
        sessionId: String = "session-id-1",
        createdAt: Long = 98765,
        appVersion: String = "1.0.0",
        appBuild: String = "1000",
    ) = SessionRecord(
        id = sessionId,
        createdAt = createdAt,
        appVersion = appVersion,
        appBuild = appBuild,
    )
}
