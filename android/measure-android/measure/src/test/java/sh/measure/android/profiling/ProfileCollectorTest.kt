package sh.measure.android.profiling

import android.os.ProfilingTrigger
import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeSampler
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.SessionRecord
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.TestClock
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import kotlin.io.path.createTempDirectory

@RunWith(AndroidJUnit4::class)
class ProfileCollectorTest {
    private val logger = NoopLogger()
    private val systemServiceProvider = mock<SystemServiceProvider>()
    private val signalProcessor = mock<SignalProcessor>()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val ioExecutor = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val sampler = FakeSampler()
    private val sessionManager = FakeSessionManager()

    private val profileCollector = ProfileCollector(
        logger = logger,
        systemServiceProvider = systemServiceProvider,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        ioExecutor = ioExecutor,
        sampler = sampler,
        sessionManager = sessionManager,
    )

    private val tempDir = createTempDirectory("profiling-test").toFile()

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    private fun parseFileTimestamp(timestamp: String): Long = SimpleDateFormat("yyyy-MM-dd-HH-mm-ss", Locale.US).parse(timestamp)!!.time

    @Test
    fun `attributes an anr profile to the session that had the anr, using the anr time`() {
        val fileTimestamp = "2026-07-05-17-51-56-124"
        val profileTime = parseFileTimestamp(fileTimestamp)
        val file = File(tempDir, "profile_trigger-type-2_${fileTimestamp}_uid-10229.perfetto-trace")
        file.writeText("trace")
        val anrTime = profileTime - 15_000
        val anrSession = SessionRecord(
            id = "anr-session",
            createdAt = profileTime - 60_000,
            appVersion = "1.0.0",
            appBuild = "100",
            lastAnrTime = anrTime,
        )
        // the profile time falls after a relaunch, so resolving purely by time would
        // pick the relaunch session, but the ANR match wins.
        val relaunchSession = SessionRecord("relaunch-session", profileTime - 5_000, "1.0.0", "100")
        sessionManager.sessionForAnr = anrSession
        sessionManager.sessionForTime = relaunchSession

        profileCollector.handleProfilingResult(file.absolutePath, ProfilingTrigger.TRIGGER_TYPE_ANR)

        verify(signalProcessor).trackProfile(
            data = eq(ProfileData(reason = "anr", format = "perfetto_trace")),
            timestamp = eq(anrTime),
            type = eq(EventType.PROFILE),
            attachments = any(),
            sessionId = eq("anr-session"),
            sessionStartTime = eq(profileTime - 60_000),
            appVersion = eq("1.0.0"),
            appBuild = eq("100"),
            isSampled = eq(true),
        )
    }

    @Test
    fun `attributes an anr profile by time when no session had a matching anr`() {
        val fileTimestamp = "2026-07-05-17-51-56-124"
        val profileTime = parseFileTimestamp(fileTimestamp)
        val file = File(tempDir, "profile_trigger-type-2_${fileTimestamp}_uid-10229.perfetto-trace")
        file.writeText("trace")
        val timeSession = SessionRecord("time-session", profileTime - 5_000, "1.0.0", "100")
        sessionManager.sessionForTime = timeSession

        profileCollector.handleProfilingResult(file.absolutePath, ProfilingTrigger.TRIGGER_TYPE_ANR)

        verify(signalProcessor).trackProfile(
            data = eq(ProfileData(reason = "anr", format = "perfetto_trace")),
            timestamp = eq(profileTime),
            type = eq(EventType.PROFILE),
            attachments = any(),
            sessionId = eq("time-session"),
            sessionStartTime = eq(profileTime - 5_000),
            appVersion = eq("1.0.0"),
            appBuild = eq("100"),
            isSampled = eq(true),
        )
    }

    @Test
    fun `attributes an app launch profile to the session active at the profile time`() {
        val fileTimestamp = "2026-07-05-17-51-56-124"
        val profileTime = parseFileTimestamp(fileTimestamp)
        val file = File(tempDir, "profile_trigger-type-1_${fileTimestamp}_uid-10229.perfetto-trace")
        file.writeText("trace")
        val session = SessionRecord("launch-session", profileTime - 2_000, "1.0.0", "100")
        sessionManager.sessionForTime = session

        profileCollector.handleProfilingResult(file.absolutePath, ProfilingTrigger.TRIGGER_TYPE_APP_FULLY_DRAWN)

        assertTrue(sessionManager.sessionForAnrCalls.isEmpty())
        verify(signalProcessor).trackProfile(
            data = eq(ProfileData(reason = "app_fully_drawn", format = "perfetto_trace")),
            timestamp = eq(profileTime),
            type = eq(EventType.PROFILE),
            attachments = any(),
            sessionId = eq("launch-session"),
            sessionStartTime = eq(profileTime - 2_000),
            appVersion = eq("1.0.0"),
            appBuild = eq("100"),
            isSampled = eq(true),
        )
    }

    @Test
    fun `tracks profile against the current session when no session matches`() {
        val file = File(tempDir, "profile_trigger-type-2_2026-07-05-17-51-56-124_uid-10229.perfetto-trace")
        file.writeText("trace")

        profileCollector.handleProfilingResult(file.absolutePath, ProfilingTrigger.TRIGGER_TYPE_ANR)

        verify(signalProcessor).trackProfile(
            data = eq(ProfileData(reason = "anr", format = "perfetto_trace")),
            timestamp = any(),
            type = eq(EventType.PROFILE),
            attachments = any(),
            sessionId = eq(sessionManager.getSessionId()),
            sessionStartTime = isNull(),
            appVersion = isNull(),
            appBuild = isNull(),
            isSampled = eq(true),
        )
    }

    @Test
    fun `parses file timestamps without milliseconds`() {
        val fileTimestamp = "2026-07-05-17-51-56"
        val profileTime = parseFileTimestamp(fileTimestamp)
        // older profiling module versions name files without millis or a uid suffix
        val file = File(tempDir, "profile_trigger_1_$fileTimestamp.perfetto-trace")
        file.writeText("trace")
        file.setLastModified(1751700000000L)
        val session = SessionRecord("launch-session", profileTime - 2_000, "1.0.0", "100")
        sessionManager.sessionForTime = session

        profileCollector.handleProfilingResult(file.absolutePath, ProfilingTrigger.TRIGGER_TYPE_APP_FULLY_DRAWN)

        assertEquals(listOf(profileTime), sessionManager.sessionForTimeCalls)
        verify(signalProcessor).trackProfile(
            data = any(),
            timestamp = eq(profileTime),
            type = any(),
            attachments = any(),
            sessionId = eq("launch-session"),
            sessionStartTime = eq(profileTime - 2_000),
            appVersion = eq("1.0.0"),
            appBuild = eq("100"),
            isSampled = eq(true),
        )
    }

    @Test
    fun `uses the file modified time when the file name has no timestamp`() {
        val file = File(tempDir, "profile.perfetto-trace")
        file.writeText("trace")
        val lastModified = 1751700000000L
        file.setLastModified(lastModified)

        profileCollector.handleProfilingResult(file.absolutePath, ProfilingTrigger.TRIGGER_TYPE_APP_FULLY_DRAWN)

        assertEquals(listOf(lastModified), sessionManager.sessionForTimeCalls)
        verify(signalProcessor).trackProfile(
            data = any(),
            timestamp = eq(lastModified),
            type = any(),
            attachments = any(),
            sessionId = any(),
            sessionStartTime = isNull(),
            appVersion = isNull(),
            appBuild = isNull(),
            isSampled = eq(true),
        )
    }

    @Test
    fun `does not track profile when not sampled`() {
        val file = File(tempDir, "profile_trigger-type-2_2026-07-05-17-51-56-124_uid-10229.perfetto-trace")
        file.writeText("trace")
        sampler.isProfileSampled = false

        profileCollector.handleProfilingResult(file.absolutePath, ProfilingTrigger.TRIGGER_TYPE_ANR)

        verifyNoInteractions(signalProcessor)
    }
}
