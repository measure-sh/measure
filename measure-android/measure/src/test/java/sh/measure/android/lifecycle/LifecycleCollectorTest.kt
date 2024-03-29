package sh.measure.android.lifecycle

import android.os.Bundle
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
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
import sh.measure.android.events.EventProcessor
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.utils.iso8601Timestamp

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
            onAppForeground = {},
            onAppBackground = {},
        ).apply { register() }
        controller = buildActivity(TestLifecycleActivity::class.java)
    }

    @Test
    fun `tracks activity onCreate event`() {
        controller.setup()
        verify(eventProcessor, atMostOnce()).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.CREATED,
                class_name = TestLifecycleActivity::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    @Test
    fun `tracks activity onCreate event with savedInstanceState when activity is recreated`() {
        controller.setup().recreate()
        verify(eventProcessor).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.CREATED,
                class_name = TestLifecycleActivity::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
        verify(eventProcessor).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.CREATED,
                class_name = TestLifecycleActivity::class.java.name,
                saved_instance_state = true,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    @Test
    fun `tracks activity onResume`() {
        controller.setup()
        verify(eventProcessor, atMostOnce()).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.RESUMED,
                class_name = TestLifecycleActivity::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    @Test
    fun `tracks activity onPause`() {
        controller.setup().pause()
        verify(eventProcessor, atMostOnce()).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.PAUSED,
                class_name = TestLifecycleActivity::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    @Test
    fun `tracks activity onDestroy`() {
        controller.setup().destroy()
        verify(eventProcessor, atMostOnce()).trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.DESTROYED,
                class_name = TestLifecycleActivity::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    @Test
    fun `tracks fragment onAttached`() {
        controller.setup()
        verify(eventProcessor, atMostOnce()).trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleType.ATTACHED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    @Test
    fun `tracks fragment onResumed`() {
        controller.setup()
        verify(eventProcessor, atMostOnce()).trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleType.RESUMED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    @Test
    fun `tracks fragment onPaused`() {
        controller.setup().pause()
        verify(eventProcessor, atMostOnce()).trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleType.PAUSED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
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
        verify(eventProcessor, atMostOnce()).trackApplicationLifecycleEvent(
            ApplicationLifecycleEvent(
                type = AppLifecycleType.BACKGROUND,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    @Test
    fun `tracks application background event when first activity starts`() {
        controller.setup()
        verify(eventProcessor, atMostOnce()).trackApplicationLifecycleEvent(
            ApplicationLifecycleEvent(
                type = AppLifecycleType.FOREGROUND,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    @Test
    fun `does not trigger application lifecycle events on configuration change`() {
        controller.setup().configurationChange()
        verify(eventProcessor, atMostOnce()).trackApplicationLifecycleEvent(
            ApplicationLifecycleEvent(
                type = AppLifecycleType.FOREGROUND,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
        verify(eventProcessor, never()).trackApplicationLifecycleEvent(
            ApplicationLifecycleEvent(
                type = AppLifecycleType.BACKGROUND,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
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
            onAppForeground = { foreground = true },
            onAppBackground = {},
        ).apply { register() }
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
            onAppForeground = {},
            onAppBackground = { background = true },
        ).apply { register() }
        controller.setup().stop()
        Assert.assertTrue(background)
    }
}

internal class TestLifecycleActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportFragmentManager.beginTransaction().add(TestFragment(), "test-fragment").commit()
    }
}

internal class TestFragment : Fragment()
