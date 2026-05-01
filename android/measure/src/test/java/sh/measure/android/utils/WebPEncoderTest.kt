package sh.measure.android.utils

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.fakes.NoopLogger

@RunWith(AndroidJUnit4::class)
class WebPEncoderTest {
    private val logger = NoopLogger()

    @Test
    fun `returns null for malformed input`() {
        // pixel buffer too small for declared
        // dimensions to force an error
        val pixels = ByteArray(4)
        val result =
            WebPEncoder.encode(pixels, width = 2, height = 2, quality = 25, logger = logger)
        assertNull(result)
    }

    @Test
    fun `encodes a valid 2x2 RGBA buffer`() {
        // We just verify the wiring produces
        // non-empty bytes for a valid input.
        val pixels = ByteArray(2 * 2 * 4)

        val encoded =
            WebPEncoder.encode(pixels, width = 2, height = 2, quality = 25, logger = logger)

        assertNotNull(encoded)
        assertTrue("expected non-empty encoded bytes", encoded!!.isNotEmpty())
    }
}
