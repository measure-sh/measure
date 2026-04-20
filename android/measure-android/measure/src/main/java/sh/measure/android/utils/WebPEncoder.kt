package sh.measure.android.utils

import android.graphics.Bitmap
import androidx.core.graphics.createBitmap
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.nio.ByteBuffer

/**
 * Encodes an RGBA pixel buffer to WebP. This is built purposefully
 * for Flutter which encodes the bytes using ImageByteFormat.rawRgba
 */
internal object WebPEncoder {
    fun encode(
        pixels: ByteArray,
        width: Int,
        height: Int,
        quality: Int,
        logger: Logger,
    ): ByteArray? {
        if (width <= 0 || height <= 0) return null
        if (pixels.size != width * height * 4) return null
        var bitmap: Bitmap? = null
        return try {
            bitmap = createBitmap(width, height)
            bitmap.copyPixelsFromBuffer(ByteBuffer.wrap(pixels))
            BitmapHelper.compressBitmap(bitmap, quality, logger)?.second
        } catch (_: Throwable) {
            logger.log(LogLevel.Error, "WebPEncoder: failed to encode bitmap")
            null
        } finally {
            bitmap?.recycle()
        }
    }
}
