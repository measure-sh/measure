package sh.measure.android.performance

import android.app.ActivityManager.RunningAppProcessInfo
import org.junit.Assert.assertEquals
import org.junit.Test

internal class ProcessStateTest {
    @Test
    fun `maps IMPORTANCE_FOREGROUND to foreground`() {
        assertEquals(
            ProcessState.FOREGROUND,
            ProcessState.from(RunningAppProcessInfo.IMPORTANCE_FOREGROUND),
        )
    }

    @Test
    fun `maps IMPORTANCE_FOREGROUND_SERVICE to user_perceived_service`() {
        assertEquals(
            ProcessState.USER_PERCEIVED_SERVICE,
            ProcessState.from(RunningAppProcessInfo.IMPORTANCE_FOREGROUND_SERVICE),
        )
    }

    @Test
    fun `maps IMPORTANCE_VISIBLE to user_perceived_service`() {
        assertEquals(
            ProcessState.USER_PERCEIVED_SERVICE,
            ProcessState.from(RunningAppProcessInfo.IMPORTANCE_VISIBLE),
        )
    }

    @Test
    fun `maps IMPORTANCE_PERCEPTIBLE to user_perceived_service`() {
        assertEquals(
            ProcessState.USER_PERCEIVED_SERVICE,
            ProcessState.from(RunningAppProcessInfo.IMPORTANCE_PERCEPTIBLE),
        )
    }

    @Test
    fun `maps IMPORTANCE_SERVICE to background`() {
        assertEquals(
            ProcessState.BACKGROUND,
            ProcessState.from(RunningAppProcessInfo.IMPORTANCE_SERVICE),
        )
    }

    @Test
    fun `maps the importance just below IMPORTANCE_CACHED to background`() {
        assertEquals(
            ProcessState.BACKGROUND,
            ProcessState.from(RunningAppProcessInfo.IMPORTANCE_CACHED - 1),
        )
    }

    @Test
    fun `maps IMPORTANCE_CACHED to cached`() {
        assertEquals(
            ProcessState.CACHED,
            ProcessState.from(RunningAppProcessInfo.IMPORTANCE_CACHED),
        )
    }

    @Test
    fun `maps IMPORTANCE_GONE to cached`() {
        assertEquals(
            ProcessState.CACHED,
            ProcessState.from(RunningAppProcessInfo.IMPORTANCE_GONE),
        )
    }
}
