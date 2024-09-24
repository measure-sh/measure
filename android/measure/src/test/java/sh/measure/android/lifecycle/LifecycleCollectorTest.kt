package sh.measure.android.lifecycle

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert
import org.junit.Before
import org.junit.Ignore
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.atMostOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.kotlin.never
import org.robolectric.Robolectric.buildActivity
import org.robolectric.RuntimeEnvironment
import org.robolectric.android.controller.ActivityController
import sh.measure.android.TestLifecycleActivity
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeTimeProvider

@RunWith(AndroidJUnit4::class)
class LifecycleCollectorTest {

    private lateinit var lifecycleCollector: LifecycleCollector
    private val eventProcessor: EventProcessor = mock()
    private val timeProvider = FakeTimeProvider()
    private lateinit var controller: ActivityController<TestLifecycleActivity>

    @Before
    fun setUp() {
        lifecycleCollector = LifecycleCollector(
            RuntimeEnvironment.getApplication(),
            eventProcessor,
            timeProvider,
        ).apply { register() }
        controller = buildActivity(TestLifecycleActivity::class.java)
    }

    @Test
    fun `tracks activity onCreate event`() {
        controller.setup()
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
        verify(eventProcessor).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.CREATED,
                class_name = TestLifecycleActivity::class.java.name,
            ),
        )

        verify(eventProcessor).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
    @Ignore("onDetached seems to not get called in tests")
    fun `tracks fragment onDetached`() {
    }

    @Test
    fun `tracks application background event when all activities are stopped`() {
        controller.setup().stop()
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.BACKGROUND,
            ),
        )
    }

    @Test
    fun `tracks application background event when first activity starts`() {
        controller.setup()
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.FOREGROUND,
            ),
        )
    }

    @Test
    fun `does not trigger application lifecycle events on configuration change`() {
        controller.setup().configurationChange()
        verify(eventProcessor, atMostOnce()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.FOREGROUND,
            ),
        )
        verify(eventProcessor, never()).track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.BACKGROUND,
            ),
        )
    }

    @Test
    fun `invokes onAppForeground when app comes to foreground`() {
        var foreground = false
        lifecycleCollector = LifecycleCollector(
            RuntimeEnvironment.getApplication(),
            eventProcessor,
            timeProvider,
        ).apply {
            register()
            setApplicationLifecycleStateListener(object : ApplicationLifecycleStateListener {
                override fun onAppForeground() {
                    foreground = true
                }

                override fun onAppBackground() {}
            })
        }
        controller.setup()
        Assert.assertTrue(foreground)
    }

    @Test
    fun `invokes onAppBackground when app goes to background`() {
        var background = false
        lifecycleCollector = LifecycleCollector(
            RuntimeEnvironment.getApplication(),
            eventProcessor,
            timeProvider,
        ).apply {
            register()
            setApplicationLifecycleStateListener(object :
                ApplicationLifecycleStateListener {
                override fun onAppForeground() {}
                override fun onAppBackground() {
                    background = true
                }
            })
        }
        controller.setup().stop()
        Assert.assertTrue(background)
    }
}

internal class TestFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        childFragmentManager.beginTransaction().add(ChildFragment(), "child-fragment").commit()
    }
}

internal class ChildFragment : Fragment()
