package sh.measure.android.anr

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
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.robolectric.annotation.Config
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.logger.Logger
import sh.measure.android.utils.SystemServiceProvider
import java.io.ByteArrayInputStream

@RunWith(AndroidJUnit4::class)
@Config(sdk = [Build.VERSION_CODES.R])
class AnrExitImplTest {
    private val logger: Logger = NoopLogger()
    private val systemServiceProvider: SystemServiceProvider = mock()
    private val activityManager: ActivityManager = mock()
    private val anrExit: AnrExitImpl =
        AnrExitImpl(logger, systemServiceProvider)

    @Before
    fun setup() {
        `when`(systemServiceProvider.activityManager).thenReturn(activityManager)
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.Q])
    fun `get returns null for SDK version below R`() {
        assertNull(anrExit.get())
    }

    @Test
    fun `get returns only the exits caused by an ANR`() {
        val anrExitInfo = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )
        val crashExitInfo = mockApplicationExitInfo(
            2,
            ApplicationExitInfo.REASON_CRASH,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED,
        )

        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 0))
            .thenReturn(listOf(anrExitInfo, crashExitInfo))

        val result = anrExit.get()

        assertEquals(listOf(1), result?.map { it.pid })
        assertEquals(1234567890L, result?.single()?.timestampMs)
        assertEquals(true, result?.single()?.foreground)
    }

    @Test
    fun `get reads an exit from a process that was not in the foreground`() {
        val anrExitInfo = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_SERVICE,
        )

        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 0))
            .thenReturn(listOf(anrExitInfo))

        assertEquals(false, anrExit.get()?.single()?.foreground)
    }

    @Test
    fun `get leaves the traces unread`() {
        val anrExitInfo = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )

        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 0))
            .thenReturn(listOf(anrExitInfo))

        val result = anrExit.get()

        assertNull(result?.single()?.threadDump)
        verify(anrExitInfo, never()).traceInputStream
    }

    @Test
    fun `withTrace reads the dump from the exit record it belongs to`() {
        val anrExitInfo = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_ANR,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )
        `when`(anrExitInfo.traceInputStream)
            .thenReturn(ByteArrayInputStream(TestData.rawAnrTrace().toByteArray()))
        `when`(activityManager.getHistoricalProcessExitReasons(null, 1, 0))
            .thenReturn(listOf(anrExitInfo))

        val result = anrExit.withTrace(
            TestData.getAnrExit(pid = 1, timestampMs = 1234567890L, threadDump = null),
        )

        assertTrue(result.threadDump!!.startsWith("DALVIK THREADS (41):"))
        assertEquals(
            "Broadcast of Intent { flg=0x10000010 xflg=0x4 " +
                "cmp=sh.frankenstein.android/.AnrBroadcastReceiver }",
            result.subject,
        )
    }

    @Test
    fun `withTrace returns the exit unchanged when the system kept no record of it`() {
        `when`(activityManager.getHistoricalProcessExitReasons(null, 1, 0))
            .thenReturn(emptyList())
        val exit = TestData.getAnrExit(pid = 1, threadDump = null)

        assertEquals(exit, anrExit.withTrace(exit))
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
