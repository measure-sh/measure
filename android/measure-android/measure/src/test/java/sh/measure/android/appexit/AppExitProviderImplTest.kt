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
import java.io.ByteArrayInputStream

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
    fun `get returns only the exits caused by an ANR`() {
        val anrExit = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )
        val crashExit = mockApplicationExitInfo(
            2,
            ApplicationExitInfo.REASON_CRASH,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED,
        )

        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 0))
            .thenReturn(listOf(anrExit, crashExit))

        val result = appExitProvider.get()

        assertEquals(setOf(1), result?.keys)
        assertEquals("ANR", result?.get(1)?.reason)
        assertEquals("FOREGROUND", result?.get(1)?.importance)
    }

    @Test
    fun `parseAnrTrace returns null for null input stream`() {
        assertNull(appExitProvider.parseAnrTrace(null))
    }

    @Test
    fun `parseAnrTrace keeps just the thread information and stacktrace`() {
        val sampleTrace = """
            DALVIK THREADS (6):
            "main" prio=5 tid=1 Sleeping
              | group="main" sCount=1 dsCount=0 flags=1 obj=0x74ff9560 self=0x7aaad37000
              | sysTid=30075 nice=-10 cgrp=default sched=0/0 handle=0x7ab27e1500
              | state=S schedstat=( 313677631 53881771 473 ) utm=24 stm=7 core=2 HZ=100
              | stack=0x7ff8479000-0x7ff847b000 stackSize=8188KB
              | held mutexes=
              at java.lang.Thread.sleep(Native method)
              at java.lang.Thread.sleep(Thread.java:373)
              at java.lang.Thread.sleep(Thread.java:314)
              at com.example.app.MainActivity.onCreate(MainActivity.kt:15)

            ----- Waiting Channels: pid 30075 at 2023-04-01 12:34:56 -----
            Waiting Thread: 4
        """.trimIndent()

        val inputStream = ByteArrayInputStream(sampleTrace.toByteArray())
        val result = appExitProvider.parseAnrTrace(inputStream)

        val expected = """
            DALVIK THREADS (6):
            "main" prio=5 tid=1 Sleeping
              at java.lang.Thread.sleep(Native method)
              at java.lang.Thread.sleep(Thread.java:373)
              at java.lang.Thread.sleep(Thread.java:314)
              at com.example.app.MainActivity.onCreate(MainActivity.kt:15)

        """.trimIndent()

        assertEquals(expected, result?.threadDump)
        assertNull(result?.subject)
    }

    @Test
    fun `parseAnrTrace reads the subject from the header above the thread dump`() {
        val sampleTrace = """
            ----- pid 30075 at 2026-07-31 19:23:31 -----
            Cmd line: com.example.app
            Subject: Input dispatching timed out (ANR in com.example.app)
            Build fingerprint: 'generic/sdk/generic:14/UPB/eng:userdebug/test-keys'
            DALVIK THREADS (2):
            "main" prio=5 tid=1 Blocked
              at com.example.app.MainActivity.onCreate(MainActivity.kt:15)

            ----- Waiting Channels: pid 30075 at 2026-07-31 19:23:31 -----
        """.trimIndent()

        val inputStream = ByteArrayInputStream(sampleTrace.toByteArray())
        val result = appExitProvider.parseAnrTrace(inputStream)

        assertEquals(
            "Input dispatching timed out (ANR in com.example.app)",
            result?.subject,
        )
        assertEquals(
            """
            DALVIK THREADS (2):
            "main" prio=5 tid=1 Blocked
              at com.example.app.MainActivity.onCreate(MainActivity.kt:15)

            """.trimIndent(),
            result?.threadDump,
        )
    }

    @Test
    fun `parseAnrTrace stops on a thread boundary when the dump exceeds the size limit`() {
        val sampleTrace = buildString {
            append("DALVIK THREADS (1400):\n")
            repeat(1400) { append(threadBlock(it)) }
        }

        val inputStream = ByteArrayInputStream(sampleTrace.toByteArray())
        val threadDump = appExitProvider.parseAnrTrace(inputStream)!!.threadDump

        assertTrue(threadDump.length <= 1024 * 1024)
        assertTrue(sampleTrace.startsWith(threadDump))
        // What follows the cut is the blank line closing the last thread kept,
        // then the header of the thread that did not fit.
        assertEquals('\n', sampleTrace[threadDump.length])
        assertEquals('"', sampleTrace[threadDump.length + 1])
    }

    private fun threadBlock(index: Int): String = buildString {
        append("\"thread-$index\" prio=5 tid=$index Blocked\n")
        repeat(20) {
            append("  at com.example.app.Klass.method$it(Klass.kt:$it)\n")
        }
        append("\n")
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
