package sh.measure.android.utils

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

internal class ClassUtilTest {
    @Test
    fun `reports class available when on the classpath`() {
        // androidx.work is on the unit test classpath via testImplementation.
        assertTrue(isClassAvailable("androidx.work.WorkManager"))
    }

    @Test
    fun `reports class unavailable when not on the classpath`() {
        assertFalse(isClassAvailable("com.example.DoesNotExist"))
    }
}
