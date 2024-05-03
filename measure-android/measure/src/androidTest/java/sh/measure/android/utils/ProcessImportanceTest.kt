package sh.measure.android.utils

import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.TestActivity

@RunWith(AndroidJUnit4::class)
class ProcessImportanceTest {

    @Test
    fun returnsFalseWhenAppIsInBackground() {
        ActivityScenario.launch(TestActivity::class.java)
        Espresso.pressBackUnconditionally()
        val result = ProcessInfoProviderImpl().isForegroundProcess()
        assertEquals(false, result)
    }

    @Test
    fun returnsTrueWhenAppIsInForeground() {
        ActivityScenario.launch(TestActivity::class.java)
        val result = ProcessInfoProviderImpl().isForegroundProcess()
        assertEquals(true, result)
    }
}
