package sh.measure.android.bugreport

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.FutureTask

@RunWith(AndroidJUnit4::class)
class ScreenshotSlotTest {
    private val encoded = EncodedScreenshot(
        name = "screenshot.webp",
        path = "/tmp/screenshot.webp",
    )

    @Test
    fun `an encode that finished before discard is still available for cleanup`() {
        val slot = slot()
        val task = FutureTask { encoded }
        slot.encodeFuture = task
        slot.onEncoded(encoded)

        assertTrue(slot.discard())

        assertTrue(task.isCancelled)
        assertEquals(encoded, slot.awaitEncoded())
    }

    @Test
    fun `discarding releases the preview and notifies a waiting listener`() {
        val slot = slot()
        var delivered: EncodedScreenshot? = encoded
        slot.setListener { delivered = it }

        assertTrue(slot.discard())

        assertNull(delivered)
        assertNull(slot.preview)
    }

    @Test
    fun `discarding twice reports the flow ended once`() {
        val slot = slot()

        assertTrue(slot.discard())
        assertTrue(!slot.discard())
    }

    @Test
    fun `delivering after discard is ignored`() {
        val slot = slot()
        slot.discard()

        slot.deliver(encoded)

        assertNull(slot.encoded)
    }

    private fun slot() = ScreenshotSlot(Bitmap.createBitmap(2, 4, Bitmap.Config.ARGB_8888))
}
