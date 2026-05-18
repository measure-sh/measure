package sh.measure.android.appexit

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
        ) // IMPORTANCE_BACKGROUND is not in the getImportanceName method
    }

    @Test
    fun `getTraceString returns null for null input stream`() {
        assertNull(appExitProvider.getTraceString(null))
    }

    @Test
    fun `getTraceString extracts content from trace with just the thread information and stacktrace`() {
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
        val result = appExitProvider.getTraceString(inputStream)

        val expected = """
            DALVIK THREADS (6):
            "main" prio=5 tid=1 Sleeping
              at java.lang.Thread.sleep(Native method)
              at java.lang.Thread.sleep(Thread.java:373)
              at java.lang.Thread.sleep(Thread.java:314)
              at com.example.app.MainActivity.onCreate(MainActivity.kt:15)
            
        """.trimIndent()

        assertEquals(expected, result)
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
