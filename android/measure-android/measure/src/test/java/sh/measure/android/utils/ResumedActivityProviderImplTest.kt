package sh.measure.android.utils

import android.app.Application
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric.buildActivity
import sh.measure.android.TestLifecycleActivity

@RunWith(AndroidJUnit4::class)
class ResumedActivityProviderImplTest {
    private val application =
        InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
    private val resumedActivityProvider: ResumedActivityProvider =
        ResumedActivityProviderImpl(application)

    private val controller = buildActivity(TestLifecycleActivity::class.java)

    @Test
    fun `returns resumed activity if any, otherwise null`() {
        resumedActivityProvider.register()

        assert(resumedActivityProvider.getResumedActivity() == null)

        controller.setup()
        assert(resumedActivityProvider.getResumedActivity() == controller.get())

        controller.pause()
        assert(resumedActivityProvider.getResumedActivity() == null)
    }
}
