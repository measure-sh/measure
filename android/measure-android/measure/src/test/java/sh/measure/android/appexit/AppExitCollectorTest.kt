package sh.measure.android.appexit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
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
import java.io.File

class AppExitCollectorTest {
    private val appExitProvider = FakeAppExitProvider()
    private val signalProcessor = mock<SignalProcessor>()
    private val sessionManager = FakeSessionManager()

    private val database = mock<Database>()
    private val processInfo = FakeProcessInfoProvider(id = 999)

    private val fileStorage = mock<FileStorage>()

    @get:Rule
    val temporaryFolder = TemporaryFolder()

    private val appExitCollector = AppExitCollector(
        NoopLogger(),
        appExitProvider,
        signalProcessor,
        sessionManager,
        database,
        fileStorage,
        processInfo,
    )

    @Test
    fun `given session is available for given pid, tracks app exit event`() {
        // Given
        val appExit = TestData.getAppExit()
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
        val appExit1 = TestData.getAppExit()
        val session1 =
            getSession(sessionId = "session-1", pid = 1, appVersion = "1.1.1", appBuild = "111")
        val appExit2 = TestData.getAppExit()
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
        val appExit = TestData.getAppExit()
        appExitProvider.appExits = mapOf(1 to appExit)

        // When
        appExitCollector.collect()

        // Then
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

    @Test
    fun `marks sessions as app exit tracked after collection`() {
        // Given
        val appExit1 = TestData.getAppExit()
        val session1 = getSession(sessionId = "session-1", pid = 1, createdAt = 1000)
        val appExit2 = TestData.getAppExit()
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
    fun `finalizes the anrs held by processes that have since died`() {
        appExitProvider.appExits = emptyMap()

        appExitCollector.collect()

        verify(database).finalizePendingAnrs(999)
    }

    @Test
    fun `enriches the held anr with the thread dump instead of tracking an app exit`() {
        // Given
        val bodyFile = writeAnrBody("event-id-1")
        whenever(database.getPendingAnrs()).thenReturn(
            listOf(PendingAnr("event-id-1", "2026-07-31T10:00:00.00000000Z", bodyFile.path, 1)),
        )
        appExitProvider.appExits = mapOf(
            1 to TestData.getAppExit(
                trace = "DALVIK THREADS (1):",
                subject = "Input dispatching timed out",
            ),
        )
        sessionManager.appExitSessions[1] = getSession(1)

        // When
        appExitCollector.collect()

        // Then
        val enriched = readAnrBody(bodyFile)
        assertEquals("DALVIK THREADS (1):", enriched.art_thread_dump)
        assertEquals("Input dispatching timed out", enriched.subject)
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

    @Test
    fun `enriches the latest anr held by a process when it held several`() {
        // Given
        val earlierFile = writeAnrBody("earlier")
        val laterFile = writeAnrBody("later")
        whenever(database.getPendingAnrs()).thenReturn(
            listOf(
                PendingAnr("earlier", "2026-07-31T10:00:00.00000000Z", earlierFile.path, 1),
                PendingAnr("later", "2026-07-31T10:05:00.00000000Z", laterFile.path, 1),
            ),
        )
        appExitProvider.appExits = mapOf(
            1 to TestData.getAppExit(
                trace = "DALVIK THREADS (1):",
            ),
        )

        // When
        appExitCollector.collect()

        // Then
        assertEquals("DALVIK THREADS (1):", readAnrBody(laterFile).art_thread_dump)
        assertNull(readAnrBody(earlierFile).art_thread_dump)
    }

    private fun writeAnrBody(eventId: String): File {
        val file = temporaryFolder.newFile(eventId)
        file.writeText(
            jsonSerializer.encodeToString(
                ExceptionData.serializer(),
                TestData.getExceptionData(),
            ),
        )
        whenever(fileStorage.getFile(file.path)).thenReturn(file)
        return file
    }

    private fun readAnrBody(file: File): ExceptionData = jsonSerializer.decodeFromString(ExceptionData.serializer(), file.readText())

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
