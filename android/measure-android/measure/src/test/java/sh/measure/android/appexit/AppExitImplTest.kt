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
class AppExitImplTest {
    private val logger: Logger = NoopLogger()
    private val systemServiceProvider: SystemServiceProvider = mock()
    private val activityManager: ActivityManager = mock()
    private val appExit: AppExitImpl =
        AppExitImpl(logger, systemServiceProvider)

    @Before
    fun setup() {
        `when`(systemServiceProvider.activityManager).thenReturn(activityManager)
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.Q])
    fun `get returns null for SDK version below R`() {
        assertNull(appExit.get())
    }

    @Test
    fun `get returns map of AppExitData when SDK is R or above`() {
        val exitInfo = mockApplicationExitInfo(
            2,
            ApplicationExitInfo.REASON_LOW_MEMORY,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED,
        )
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 0))
            .thenReturn(listOf(exitInfo))

        val result = appExit.get()

        assertEquals(1, result?.size)
        assertEquals("LOW_MEMORY", result?.get(2)?.reason)
        assertEquals("CACHED", result?.get(2)?.importance)
        assertEquals("com.example.app", result?.get(2)?.process_name)
        assertEquals(1234567890L, result?.get(2)?.app_exit_time_ms)
    }

    @Test
    fun `get drops an exit the sdk reports itself`() {
        val reported = listOf(
            ApplicationExitInfo.REASON_ANR,
            ApplicationExitInfo.REASON_CRASH,
            ApplicationExitInfo.REASON_CRASH_NATIVE,
            ApplicationExitInfo.REASON_SIGNALED,
        )

        reported.forEach { reason ->
            val exitInfo = mockApplicationExitInfo(
                1,
                reason,
                ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
            )
            `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 0))
                .thenReturn(listOf(exitInfo))

            assertTrue(appExit.get().isNullOrEmpty())
        }
    }

    @Test
    fun `get drops an ordinary exit`() {
        val exitInfo = mockApplicationExitInfo(
            1,
            ApplicationExitInfo.REASON_USER_REQUESTED,
            ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
        )
        `when`(activityManager.getHistoricalProcessExitReasons(null, 0, 0))
            .thenReturn(listOf(exitInfo))

        assertTrue(appExit.get().isNullOrEmpty())
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
