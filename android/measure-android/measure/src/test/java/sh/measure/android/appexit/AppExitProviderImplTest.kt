package sh.measure.android.appexit

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
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

@RunWith(AndroidJUnit4::class)
@Config(sdk = [Build.VERSION_CODES.R])
class AppExitProviderImplTest {
    private val logger: Logger = NoopLogger()
    private val systemServiceProvider: SystemServiceProvider = mock()
    private val activityManager: ActivityManager = mock()
    private val appExitProvider: AppExitProviderImpl =
        AppExitProviderImpl(logger, systemServiceProvider)

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
    fun `get returns map of AppExit when SDK is R or above`() {
        val exitInfo1 = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )
        val exitInfo2 = mockApplicationExitInfo(
            2,
            ApplicationExitInfo.REASON_CRASH,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED,
        )

        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 3))
            .thenReturn(listOf(exitInfo1, exitInfo2))

        val result = appExitProvider.get()

        assertEquals(2, result?.size)
        assertEquals("ANR", result?.get(1)?.reason)
        assertEquals("FOREGROUND", result?.get(1)?.importance)
        assertEquals("CRASH", result?.get(2)?.reason)
        assertEquals(
            "CACHED",
            result?.get(2)?.importance,
        )
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
    fun `toAppExit prefers the trace subject over the kill description`() {
        val exitInfo = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )
        `when`(exitInfo.traceInputStream).thenReturn(
            "Subject: Broadcast of Intent { }\nDALVIK THREADS (1):\n\"main\" prio=5 tid=1 Blocked\n"
                .byteInputStream(),
        )
        `when`(exitInfo.description)
            .thenReturn("user request after error: Broadcast of Intent { }")

        val appExit = with(appExitProvider) { exitInfo.toAppExit() }

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
            .thenReturn("DALVIK THREADS (1):\n\"main\" prio=5 tid=1 Blocked\n".byteInputStream())
        `when`(exitInfo.description).thenReturn("user request after error: Input dispatching timed out")

        val appExit = with(appExitProvider) { exitInfo.toAppExit() }

        assertEquals("user request after error: Input dispatching timed out", appExit.subject)
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

    private fun mockApplicationExitInfo(
        pid: Int,
        reason: Int,
        importance: Int,
    ): ApplicationExitInfo = mock(ApplicationExitInfo::class.java).apply {
        `when`(this.pid).thenReturn(pid)
        `when`(this.reason).thenReturn(reason)
        `when`(this.importance).thenReturn(importance)
        `when`(this.processName).thenReturn("com.example.app")
        `when`(this.timestamp).thenReturn(1234567890L)
    }
}
