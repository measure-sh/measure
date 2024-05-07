package sh.measure.android.utils

import android.app.Application
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.annotation.Config
import sh.measure.android.TestLifecycleActivity
import sh.measure.android.fakes.NoopLogger

@RunWith(AndroidJUnit4::class)
class ScreenshotHelperTest {
    private val logger = NoopLogger()
    private val controller = Robolectric.buildActivity(TestLifecycleActivity::class.java)

    @Test
    @Config(sdk = [21, 33])
    fun returnsScreenshotWhenResumedActivityIsAvailable() {
        val application =
            InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
        val resumedActivityProvider = ResumedActivityProviderImpl(application).apply { register() }

        controller.setup().resume()

        val screenshot = ScreenshotHelperImpl(logger, resumedActivityProvider).takeScreenshot()
        assertNotNull(screenshot)
    }

    @Test
    @Config(sdk = [21, 33])
    fun returnsNullWhenResumedActivityIsNotAvailable() {
        val application =
            InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
        val resumedActivityProvider = ResumedActivityProviderImpl(application).apply { register() }

        controller.setup().resume().destroy()

        val screenshot = ScreenshotHelperImpl(logger, resumedActivityProvider).takeScreenshot()
        assertNull(screenshot)
    }
}
