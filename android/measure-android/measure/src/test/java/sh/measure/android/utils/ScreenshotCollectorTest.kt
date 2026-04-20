package sh.measure.android.utils

import android.app.Application
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.robolectric.Robolectric
import sh.measure.android.TestLifecycleActivity
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.screenshot.ScreenshotCollectorImpl

@RunWith(AndroidJUnit4::class)
class ScreenshotCollectorTest {
    private val logger = NoopLogger()
    private val lowMemoryCheck = mock<LowMemoryCheck>()
    private val config = FakeConfigProvider()
    private val controller = Robolectric.buildActivity(TestLifecycleActivity::class.java)

    @Test
    fun `returns screenshot when resumed activity is available`() {
        val application =
            InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
        `when`(lowMemoryCheck.isLowMemory()).thenReturn(false)
        val resumedActivityProvider = ResumedActivityProviderImpl(application).apply { register() }

        controller.setup().resume()

        val screenshot = ScreenshotCollectorImpl(
            logger,
            resumedActivityProvider,
            lowMemoryCheck,
            config,
        ).takeScreenshot()
        assertNotNull(screenshot)
    }

    @Test
    fun `returns null when resumed activity is not available`() {
        val application =
            InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
        `when`(lowMemoryCheck.isLowMemory()).thenReturn(false)
        val resumedActivityProvider = ResumedActivityProviderImpl(application).apply { register() }

        controller.setup().resume().destroy()

        val screenshot = ScreenshotCollectorImpl(
            logger,
            resumedActivityProvider,
            lowMemoryCheck,
            config,

        ).takeScreenshot()
        assertNull(screenshot)
    }

    @Test
    fun `returns null when system is in low memory state`() {
        val application =
            InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
        `when`(lowMemoryCheck.isLowMemory()).thenReturn(true)
        val resumedActivityProvider = ResumedActivityProviderImpl(application).apply { register() }

        controller.setup().resume()

        val screenshot = ScreenshotCollectorImpl(
            logger,
            resumedActivityProvider,
            lowMemoryCheck,
            config,
        ).takeScreenshot()
        assertNull(screenshot)
    }

    @Test
    fun `returns screenshot when system is not in low memory state`() {
        val application =
            InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
        `when`(lowMemoryCheck.isLowMemory()).thenReturn(false)
        val resumedActivityProvider = ResumedActivityProviderImpl(application).apply { register() }

        controller.setup().resume()

        val screenshot = ScreenshotCollectorImpl(
            logger,
            resumedActivityProvider,
            lowMemoryCheck,
            config,
        ).takeScreenshot()
        assertNotNull(screenshot)
    }
}
