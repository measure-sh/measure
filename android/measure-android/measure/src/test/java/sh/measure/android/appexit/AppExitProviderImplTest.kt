package sh.measure.android.appexit

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.robolectric.annotation.Config
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.logger.Logger
import sh.measure.android.utils.SystemServiceProvider

private const val MAIN_THREAD_TRACE = "DALVIK THREADS (1):\n\"main\" prio=5 tid=1 Blocked\n" +
    "  at com.example.app.Repo.load(Repo.kt:8)\n"

@RunWith(AndroidJUnit4::class)
@Config(sdk = [Build.VERSION_CODES.R])
class AppExitProviderImplTest {
    private val logger: Logger = NoopLogger()
    private val systemServiceProvider: SystemServiceProvider = mock()
    private val activityManager: ActivityManager = mock()
    private val appExitProvider: AppExitProviderImpl =
        AppExitProviderImpl(logger, systemServiceProvider, nativeCrashReporting = true)

    @Before
    fun setup() {
        `when`(systemServiceProvider.activityManager).thenReturn(activityManager)
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.Q])
    fun `get returns null for SDK version below R`() {
        assertNull(appExitProvider.get())
    }

    @Test
    fun `get returns ANR exits with a readable trace`() {
        val anr = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
            trace = MAIN_THREAD_TRACE,
        )
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5)).thenReturn(listOf(anr))

        val appExit = appExitProvider.get()?.single { it.pid == 1 } as AppExit.Anr

        assertEquals(1234567890L, appExit.timestamp)
        assertTrue(appExit.foreground)
        assertTrue(appExit.trace.startsWith("DALVIK THREADS (1):"))
    }

    @Test
    fun `get skips ANR exits whose trace cannot be read`() {
        val anr = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5)).thenReturn(listOf(anr))

        assertEquals(emptyList<AppExit>(), appExitProvider.get())
    }

    @Test
    fun `get skips exits that are not ANRs or native crashes`() {
        val crash = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_CRASH,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
            trace = MAIN_THREAD_TRACE,
        )
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5)).thenReturn(listOf(crash))

        assertEquals(emptyList<AppExit>(), appExitProvider.get())
    }

    @Test
    fun `get marks visible exits as foreground and cached exits as background`() {
        val visible = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE,
            trace = MAIN_THREAD_TRACE,
        )
        val cached = mockApplicationExitInfo(
            2,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED,
            trace = MAIN_THREAD_TRACE,
        )
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5)).thenReturn(listOf(visible, cached))

        val result = appExitProvider.get()!!

        assertTrue(result.single { it.pid == 1 }.foreground)
        assertFalse(result.single { it.pid == 2 }.foreground)
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.S])
    fun `get skips native crash exits when native crash reporting is off`() {
        val appExitProvider = AppExitProviderImpl(logger, systemServiceProvider, nativeCrashReporting = false)
        val anr = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
            trace = MAIN_THREAD_TRACE,
        )
        val nativeCrash = mockNativeCrashExitInfo(2)
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5))
            .thenReturn(listOf(anr, nativeCrash))

        val result = appExitProvider.get()

        assertEquals(listOf(1), result?.map { it.pid })
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.S])
    fun `get keeps native crash exits when native crash reporting is on`() {
        val nativeCrash = mockNativeCrashExitInfo(2)
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5)).thenReturn(listOf(nativeCrash))

        val appExit = appExitProvider.get()?.single { it.pid == 2 } as AppExit.NativeCrash

        assertEquals("SIGSEGV", appExit.tombstone.signal.name)
        assertFalse(appExit.recoverable)
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.S])
    fun `get marks a recoverable native crash exit as recoverable`() {
        val nativeCrash = mockNativeCrashExitInfo(2)
        `when`(nativeCrash.description).thenReturn("recoverable_crash")
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5)).thenReturn(listOf(nativeCrash))

        val appExit = appExitProvider.get()?.single() as AppExit.NativeCrash

        assertTrue(appExit.recoverable)
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.S])
    fun `get keeps every native crash exit of a process`() {
        val crash = mockNativeCrashExitInfo(2)
        val recoverable = mockNativeCrashExitInfo(2)
        `when`(recoverable.description).thenReturn("recoverable_crash")
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5)).thenReturn(listOf(crash, recoverable))

        val appExits = appExitProvider.get()!!.map { it as AppExit.NativeCrash }

        assertEquals(listOf(false, true), appExits.map { it.recoverable })
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.S])
    fun `get skips native crash exits whose tombstone cannot be read`() {
        val nativeCrash = mockApplicationExitInfo(
            2,
            ApplicationExitInfo.REASON_CRASH_NATIVE,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
            trace = "not a tombstone",
        )
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5)).thenReturn(listOf(nativeCrash))

        assertEquals(emptyList<AppExit>(), appExitProvider.get())
    }

    @Test
    fun `get skips native crash exits below Android 12`() {
        val nativeCrash = mockNativeCrashExitInfo(2)
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 5)).thenReturn(listOf(nativeCrash))

        assertEquals(emptyList<AppExit>(), appExitProvider.get())
    }

    @Test
    fun `readTrace returns null for null input stream`() {
        assertNull(appExitProvider.readTrace(null))
    }

    @Test
    fun `readTrace returns null when the trace has no thread section`() {
        val trace = "Subject: Broadcast of Intent { }\nCmd line: com.example.app\n"
        assertNull(appExitProvider.readTrace(trace.byteInputStream()))
    }

    @Test
    fun `readTrace returns null when the trace has no main thread`() {
        val trace = "DALVIK THREADS (1):\n\"worker\" prio=5 tid=2 Blocked\n" +
            "  at com.example.app.Repo.load(Repo.kt:8)\n"
        assertNull(appExitProvider.readTrace(trace.byteInputStream()))
    }

    @Test
    fun `readTrace returns null when the main thread has no managed frames`() {
        val trace = "DALVIK THREADS (1):\n\"main\" prio=5 tid=1 Native\n  (no managed stack frames)\n"
        assertNull(appExitProvider.readTrace(trace.byteInputStream()))
    }

    @Test
    fun `readTrace finds the main thread by tid 1 when it is renamed`() {
        val trace = "DALVIK THREADS (1):\n\"Timber\" prio=5 tid=1 Blocked\n" +
            "  at com.example.app.Repo.load(Repo.kt:8)\n"
        assertNotNull(appExitProvider.readTrace(trace.byteInputStream()))
    }

    @Test
    fun `readTrace truncates a long trace on a thread boundary`() {
        val oversized = buildString {
            append("DALVIK THREADS (400):\n")
            repeat(400) { index ->
                append("\"thread-$index\" prio=5 tid=$index Waiting\n")
                repeat(20) {
                    append("  at com.example.app.Padding.method$it(Padding.java:$it)\n")
                }
                append("\n")
            }
        }

        val result = appExitProvider.readTrace(oversized.byteInputStream())!!.threads

        assertTrue(result.length < oversized.length)
        assertTrue(result.startsWith("DALVIK THREADS (400):\n"))

        val lastLine = result.trimEnd('\n').lines().last()
        assertTrue("truncated mid-thread on: $lastLine", lastLine.startsWith("  at "))
    }

    @Test
    fun `toAppExit prefers the trace subject over the kill description`() {
        val exitInfo = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )
        `when`(exitInfo.traceInputStream).thenReturn(
            "Subject: Broadcast of Intent { }\nDALVIK THREADS (1):\n\"main\" prio=5 tid=1 Blocked\n  at com.example.app.Repo.load(Repo.kt:8)\n"
                .byteInputStream(),
        )
        `when`(exitInfo.description)
            .thenReturn("user request after error: Broadcast of Intent { }")

        val appExit = with(appExitProvider) { exitInfo.toAppExit() } as AppExit.Anr

        assertEquals("Broadcast of Intent { }", appExit.subject)
    }

    @Test
    fun `toAppExit falls back to the description when the trace has no subject`() {
        val exitInfo = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )
        `when`(exitInfo.traceInputStream)
            .thenReturn(
                "DALVIK THREADS (1):\n\"main\" prio=5 tid=1 Blocked\n  at com.example.app.Repo.load(Repo.kt:8)\n"
                    .byteInputStream(),
            )
        `when`(exitInfo.description).thenReturn("user request after error: Input dispatching timed out")

        val appExit = with(appExitProvider) { exitInfo.toAppExit() } as AppExit.Anr

        assertEquals("user request after error: Input dispatching timed out", appExit.subject)
    }

    private fun mockNativeCrashExitInfo(pid: Int): ApplicationExitInfo = mockApplicationExitInfo(
        pid,
        ApplicationExitInfo.REASON_CRASH_NATIVE,
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
    ).apply {
        `when`(traceInputStream).thenReturn(javaClass.classLoader!!.getResourceAsStream("tombstones/api31_segv.pb"))
    }

    private fun mockApplicationExitInfo(
        pid: Int,
        reason: Int,
        importance: Int,
        trace: String? = null,
    ): ApplicationExitInfo = mock(ApplicationExitInfo::class.java).apply {
        `when`(this.pid).thenReturn(pid)
        `when`(this.traceInputStream).thenReturn(trace?.byteInputStream())
        `when`(this.reason).thenReturn(reason)
        `when`(this.importance).thenReturn(importance)
        `when`(this.processName).thenReturn("com.example.app")
        `when`(this.timestamp).thenReturn(1234567890L)
    }
}
