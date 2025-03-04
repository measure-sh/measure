package sh.measure.android.utils

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import android.os.Looper
import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric.buildActivity
import org.robolectric.Shadows.shadowOf
import sh.measure.android.MsrAttachment
import sh.measure.android.TestLifecycleActivity
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import java.io.File
import java.io.FileOutputStream

@RunWith(AndroidJUnit4::class)
class AttachmentHelperTest {
    private val controller = buildActivity(TestLifecycleActivity::class.java)
    private val logger = NoopLogger()
    private val application = InstrumentationRegistry.getInstrumentation().context
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val configProvider = FakeConfigProvider()
    private val attachmentHelper = AttachmentHelper(logger, executorService, configProvider)

    @Test
    fun `captureScreenshot triggers onCapture callback on successful screenshot capture`() {
        var attachment: MsrAttachment? = null
        controller.setup()
        attachmentHelper.captureScreenshot(controller.get(), { a ->
            attachment = a
        }, {})
        shadowOf(Looper.getMainLooper()).idle()
        Assert.assertNotNull(attachment)
    }

    @Test
    fun `captureScreenshot triggers onError callback on unsuccessful screenshot capture`() {
        var onErrorCalled = false
        // Do not launch the activity, thereby failing to capture a screenshot
        attachmentHelper.captureScreenshot(controller.get(), {}, {
            onErrorCalled = true
        })
        shadowOf(Looper.getMainLooper()).idle()
        Assert.assertEquals(true, onErrorCalled)
    }

    @Test
    fun `captureLayoutSnapshot triggers onComplete on successful capture`() {
        var attachment: MsrAttachment? = null
        controller.setup()
        attachmentHelper.captureLayoutSnapshot(controller.get(), { a ->
            attachment = a
        }, {})
        Assert.assertNotNull(attachment)
    }

    @Test
    fun `captureLayoutSnapshot triggers onError on unsuccessful capture`() {
        var onErrorCalled = false
        // Do not launch the activity, thereby failing to capture a snapshot
        attachmentHelper.captureLayoutSnapshot(controller.get(), {}, {
            onErrorCalled = true
        })
        Assert.assertEquals(true, onErrorCalled)
    }

    @Test
    fun `imageUriToAttachment triggers onComplete on successful conversion`() {
        val uri = Uri.fromFile(createTestImage())
        var attachment: MsrAttachment? = null
        controller.setup()
        attachmentHelper.imageUriToAttachment(controller.get(), uri, { a -> attachment = a }, { })
        shadowOf(Looper.getMainLooper()).idle()
        Assert.assertNotNull(attachment)
    }

    @Test
    fun `imageUriToAttachment triggers onError for invalid Uri`() {
        val invalidUri =
            Uri.parse("android.resource://${controller.get().packageName}/drawable/invalidUri")
        var onErrorCalled = false
        controller.setup()
        attachmentHelper.imageUriToAttachment(
            controller.get(),
            invalidUri,
            { },
            { onErrorCalled = true },
        )
        shadowOf(Looper.getMainLooper()).idle()
        Assert.assertTrue(onErrorCalled)
    }

    private fun createTestImage(): File {
        val testBitmap = Bitmap.createBitmap(100, 100, Bitmap.Config.ARGB_8888).apply {
            Canvas(this).drawColor(Color.RED)
        }
        return File(application.filesDir, "test_screenshot.png").also { file ->
            FileOutputStream(file).use { out ->
                testBitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }
        }
    }
}
