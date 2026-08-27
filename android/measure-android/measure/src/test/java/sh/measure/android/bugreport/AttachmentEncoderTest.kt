package sh.measure.android.bugreport

import android.app.Application
import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import sh.measure.android.TestLifecycleActivity
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.FileStorageImpl

@RunWith(AndroidJUnit4::class)
class AttachmentEncoderTest {
    private val logger = NoopLogger()
    private val application =
        InstrumentationRegistry.getInstrumentation().context as Application
    private val encoder = AttachmentEncoderImpl(
        logger = logger,
        configProvider = FakeConfigProvider(),
        fileStorage = FileStorageImpl(application.filesDir.path, logger),
        idProvider = FakeIdProvider(),
        sessionManager = FakeSessionManager(),
    )

    @Test
    fun `wide images are downscaled to a power of two under the width cap`() {
        assertEquals(1, AttachmentEncoder.sampleSizeFor(1080))
        assertEquals(2, AttachmentEncoder.sampleSizeFor(1600))
        assertEquals(2, AttachmentEncoder.sampleSizeFor(2160))
        assertEquals(4, AttachmentEncoder.sampleSizeFor(3024))
        assertEquals(4, AttachmentEncoder.sampleSizeFor(4032))
    }

    @Test
    fun `the preview is never the captured bitmap`() {
        val captured = Bitmap.createBitmap(64, 128, Bitmap.Config.ARGB_8888)

        val preview = encoder.scalePreview(captured)

        assertNotNull(preview)
        assertNotSame(captured, preview)
    }

    @Test
    fun `the preview is bounded on its longest side`() {
        val captured = Bitmap.createBitmap(1080, 2400, Bitmap.Config.ARGB_8888)

        val preview = encoder.scalePreview(captured)

        assertEquals(1024, preview?.height)
        assertEquals(461, preview?.width)
    }

    @Test
    fun `encoding recycles the screen it was given`() {
        val captured = Bitmap.createBitmap(64, 128, Bitmap.Config.ARGB_8888)

        encoder.encodeScreenshot(captured)

        assertTrue(captured.isRecycled)
    }

    @Test
    fun `captures the screen without shifting its colours`() {
        val activity = Robolectric.buildActivity(TestLifecycleActivity::class.java).setup().get()

        val bitmap = encoder.capture(activity)

        assertNotNull(bitmap)
        assertEquals(Bitmap.Config.ARGB_8888, bitmap?.config)
    }
}
