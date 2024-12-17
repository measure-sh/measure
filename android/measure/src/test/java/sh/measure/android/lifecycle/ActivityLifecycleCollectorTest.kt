package sh.measure.android.lifecycle

import android.app.Application
import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.atMostOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.robolectric.Robolectric.buildActivity
import org.robolectric.android.controller.ActivityController
import sh.measure.android.TestLifecycleActivity
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock

@RunWith(AndroidJUnit4::class)
class ActivityLifecycleCollectorTest {
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val application = InstrumentationRegistry.getInstrumentation().context as Application
    private val appLifecycleManager = AppLifecycleManager(application)
    private var activityLifecycleCollector: ActivityLifecycleCollector = ActivityLifecycleCollector(
        appLifecycleManager,
        signalProcessor,
        timeProvider,
    )
    private lateinit var controller: ActivityController<TestLifecycleActivity>

    @Before
    fun setUp() {
        appLifecycleManager.register()
        activityLifecycleCollector.register()
        controller = buildActivity(TestLifecycleActivity::class.java)
    }

    @Test
    fun `tracks activity onCreate event`() {
        controller.setup()
        verify(signalProcessor, times(1)).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.CREATED,
                class_name = TestLifecycleActivity::class.java.name,
                intent = null,
                saved_instance_state = false,
            ),
        )
    }

    @Test
    fun `tracks activity onCreate event with savedInstanceState when activity is recreated`() {
        controller.setup().recreate()
        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.CREATED,
                class_name = TestLifecycleActivity::class.java.name,
            ),
        )

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.CREATED,
                class_name = TestLifecycleActivity::class.java.name,
                saved_instance_state = true,
            ),
        )
    }

    @Test
    fun `tracks activity onResume`() {
        controller.setup()
        verify(signalProcessor, times(1)).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.RESUMED,
                class_name = TestLifecycleActivity::class.java.name,
            ),
        )
    }

    @Test
    fun `tracks activity onPause`() {
        controller.setup().pause()
        verify(signalProcessor, times(1)).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.PAUSED,
                class_name = TestLifecycleActivity::class.java.name,
            ),
        )
    }

    @Test
    fun `tracks activity onDestroy`() {
        controller.setup().destroy()
        verify(signalProcessor, times(1)).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.DESTROYED,
                class_name = TestLifecycleActivity::class.java.name,
            ),
        )
    }

    @Test
    fun `tracks fragment onAttached`() {
        controller.setup()
        verify(signalProcessor, atMostOnce()).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_FRAGMENT,
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.ATTACHED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
                parent_fragment = null,
            ),
        )
    }

    @Test
    fun `tracks fragment onResumed`() {
        controller.setup()
        verify(signalProcessor, atMostOnce()).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_FRAGMENT,
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.RESUMED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
                parent_fragment = null,
            ),
        )
    }

    @Test
    fun `tracks fragment onPaused`() {
        controller.setup().pause()
        verify(signalProcessor, atMostOnce()).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_FRAGMENT,
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.PAUSED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
                parent_fragment = null,
            ),
        )
    }

    @Test
    fun `tracks parent fragment when fragment has a parent`() {
        controller.setup()
        verify(signalProcessor, atMostOnce()).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_FRAGMENT,
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.ATTACHED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = ChildFragment::class.java.name,
                parent_fragment = TestFragment::class.java.name,
                tag = "child-fragment",
            ),
        )
    }

    @Test
    fun `unregister clears callbacks and stops tracking`() {
        controller.setup()
        activityLifecycleCollector.unregister()

        verify(signalProcessor, never()).track(
            data = any<FragmentLifecycleData>(),
            timestamp = any(),
            type = any(),
            attributes = any(),
            attachments = any(),
            threadName = any(),
            sessionId = any(),
            userTriggered = any(),
            userDefinedAttributes = any(),
        )
    }
}

internal class TestFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        childFragmentManager.beginTransaction().add(ChildFragment(), "child-fragment").commit()
    }
}

internal class ChildFragment : Fragment()
