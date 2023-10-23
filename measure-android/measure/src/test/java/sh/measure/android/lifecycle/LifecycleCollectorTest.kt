package sh.measure.android.lifecycle

import android.os.Bundle
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Before
import org.junit.Ignore
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.atMostOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.robolectric.Robolectric.*
import org.robolectric.RuntimeEnvironment
import org.robolectric.android.controller.ActivityController
import sh.measure.android.events.EventTracker
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.utils.iso8601Timestamp

@RunWith(AndroidJUnit4::class)
class LifecycleCollectorTest {

    private lateinit var lifecycleCollector: LifecycleCollector
    private val eventTracker: EventTracker = mock()
    private val timeProvider = FakeTimeProvider()
    private lateinit var controller: ActivityController<TestLifecycleActivity>

    @Before
    fun setUp() {
        lifecycleCollector = LifecycleCollector(
            RuntimeEnvironment.getApplication(), eventTracker, timeProvider
        ).apply { register() }
        controller = buildActivity(TestLifecycleActivity::class.java)
    }

    @Test
    fun onActivityCreated() {
        controller.setup()
        verify(eventTracker, atMostOnce()).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleName.CREATED,
                class_name = TestLifecycleActivity::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    @Test
    fun onActivityResumed() {
        controller.setup()
        verify(eventTracker, atMostOnce()).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleName.RESUMED,
                class_name = TestLifecycleActivity::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    @Test
    fun onActivityPaused() {
        controller.setup().pause()
        verify(eventTracker, atMostOnce()).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleName.PAUSED,
                class_name = TestLifecycleActivity::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    @Test
    fun onActivityDestroyed() {
        controller.setup().destroy()
        verify(eventTracker, atMostOnce()).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleName.DESTROYED,
                class_name = TestLifecycleActivity::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    @Test
    fun onFragmentAttached() {
        controller.setup()
        verify(eventTracker, atMostOnce()).trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleName.ATTACHED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    @Test
    fun onFragmentResumed() {
        controller.setup()
        verify(eventTracker, atMostOnce()).trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleName.RESUMED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    @Test
    fun onFragmentPaused() {
        controller.setup().pause()
        verify(eventTracker, atMostOnce()).trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleName.PAUSED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    @Test
    @Ignore("onDetached seems to not get called in tests")
    fun onFragmentDetached() {
    }
}

internal class TestLifecycleActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportFragmentManager.beginTransaction().add(TestFragment(), "test-fragment").commit()
    }
}

internal class TestFragment : Fragment()
