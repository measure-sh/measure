package sh.measure.android.layoutinspector

import android.app.Application
import android.os.Looper
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric.buildActivity
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.ResumedActivityProviderImpl
import sh.measure.android.utils.TestClock
import sh.measure.android.utils.forceDrawFrame
import sh.measure.android.utils.forceLayoutPass
import java.time.Duration

@RunWith(AndroidJUnit4::class)
class LayoutSnapshotCollectorImplTest {
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val application = InstrumentationRegistry.getInstrumentation().context as Application
    private val resumedActivityProvider = ResumedActivityProviderImpl(application)
    private val collector = createCollector()
    private lateinit var controller: ActivityController<LayoutInspectorTestActivity>

    @Before
    fun setup() {
        resumedActivityProvider.register()
        controller = buildActivity(LayoutInspectorTestActivity::class.java)
        val activity = controller.get()
        val content = FrameLayout(activity)
        content.addView(TextView(activity).apply { text = "hello" })
        activity.setContentView(content)
    }

    @Test
    fun `captureAttachment delivers a compressed snapshot of the top-most window`() {
        controller.setup()
        val captured = mutableListOf<Attachment?>()

        collector.captureAttachment { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()

        val attachment = captured.single()
        assertNotNull(attachment)
        assertEquals(AttachmentType.LAYOUT_SNAPSHOT_JSON, attachment!!.type)
        assertEquals("snapshot.json.gz", attachment.name)
    }

    @Test
    fun `captureAttachmentAfterNextDraw delivers once the resumed window has drawn`() {
        controller.setup()
        val captured = mutableListOf<Attachment?>()

        collector.captureAttachmentAfterNextDraw { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(emptyList<Attachment?>(), captured)

        controller.forceDrawFrame()
        assertNotNull(captured.single())
    }

    @Test
    fun `captureAttachmentAfterNextDraw delivers null without a resumed activity`() {
        val captured = mutableListOf<Attachment?>()

        collector.captureAttachmentAfterNextDraw { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()

        assertEquals(listOf(null), captured)
    }

    @Test
    fun `captureAttachment skips a snapshot taken too soon after the previous one`() {
        controller.setup()
        val captured = mutableListOf<Attachment?>()

        collector.captureAttachment { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()
        collector.captureAttachment { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()

        assertNotNull(captured[0])
        assertEquals(null, captured[1])
    }

    @Test
    fun `captureAttachment takes a snapshot again once the throttle window has elapsed`() {
        controller.setup()
        val captured = mutableListOf<Attachment?>()

        collector.captureAttachment { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()
        testClock.advance(Duration.ofMillis(751))
        collector.captureAttachment { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()

        assertNotNull(captured[0])
        assertNotNull(captured[1])
    }

    @Test
    fun `captureAttachmentAfterPendingLayout waits for a layout which is still pending`() {
        controller.create().start().resume()
        assertTrue(controller.get().window.decorView.isLayoutRequested)
        val captured = mutableListOf<Attachment?>()

        collector.captureAttachmentAfterPendingLayout { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(emptyList<Attachment?>(), captured)

        controller.get().window.decorView.layoutNow()
        controller.forceLayoutPass()
        assertNotNull(captured.single())
    }

    @Test
    fun `captureAttachmentAfterPendingLayout delivers without waiting once laid out`() {
        controller.setup()
        controller.get().window.decorView.layoutNow()
        assertFalse(controller.get().window.decorView.isLayoutRequested)
        val captured = mutableListOf<Attachment?>()

        collector.captureAttachmentAfterPendingLayout { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()

        assertNotNull(captured.single())
    }

    @Test
    fun `captureAttachmentAfterPendingLayout delivers null without a resumed activity`() {
        val captured = mutableListOf<Attachment?>()

        collector.captureAttachmentAfterPendingLayout { captured.add(it) }
        shadowOf(Looper.getMainLooper()).idle()

        assertEquals(listOf(null), captured)
    }

    private fun createCollector() = LayoutSnapshotCollectorImpl(
        logger = NoopLogger(),
        resumedActivityProvider = resumedActivityProvider,
        defaultExecutor = ImmediateExecutorService(ResolvableFuture.create()),
        layoutSnapshotThrottler = LayoutSnapshotThrottler(timeProvider),
    )

    private fun View.layoutNow() {
        measure(
            View.MeasureSpec.makeMeasureSpec(1080, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(1920, View.MeasureSpec.EXACTLY),
        )
        layout(0, 0, measuredWidth, measuredHeight)
    }
}
