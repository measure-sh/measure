package sh.measure.android.utils

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.view.PixelCopy
import android.view.View
import android.view.Window
import androidx.annotation.RequiresApi
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.ByteArrayOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.LazyThreadSafetyMode.NONE

/**
 * Helper object for handling bitmap operations consistently across the application.
 * Consolidates common functionality for capturing, compressing, and processing bitmaps.
 * Supports optional masking of sensitive content in screenshots.
 */
internal object BitmapHelper {
    private const val PIXEL_COPY_TIMEOUT_MS = 750L
    private const val HANDLER_THREAD_NAME = "msr-pixel-copy"
    private const val DEFAULT_MASK_RADIUS = 8f

    private val maskPaint by lazy(NONE) {
        Paint().apply {
            style = Paint.Style.FILL
        }
    }

    /**
     * Captures a bitmap of the current window content with optional masking.
     *
     * @param activity The activity to capture
     * @param logger Logger instance for debug and error logging
     * @param screenshotMaskConfig Optional configuration for masking sensitive content
     */
    fun captureBitmap(
        activity: Activity,
        logger: Logger,
        screenshotMaskConfig: ScreenshotMaskConfig? = null,
    ): Bitmap? {
        val window = activity.window ?: run {
            logger.log(LogLevel.Debug, "Unable to take screenshot, window is null.")
            return null
        }

        val decorView = window.peekDecorView() ?: run {
            logger.log(LogLevel.Debug, "Unable to take screenshot, decor view is null.")
            return null
        }

        val view = decorView.rootView ?: run {
            logger.log(LogLevel.Debug, "Unable to take screenshot, root view is null.")
            return null
        }

        if (view.width <= 0 || view.height <= 0) {
            logger.log(LogLevel.Debug, "Unable to take screenshot, invalid view bounds.")
            return null
        }

        val rectsToMask = screenshotMaskConfig?.let { config ->
            maskPaint.color = Color.parseColor(config.maskHexColor)
            config.getMaskRects(view)
        } ?: emptyList()

        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            captureBitmapUsingPixelCopy(window, bitmap, rectsToMask, logger)
        } else {
            captureBitmapUsingCanvas(
                activity,
                view,
                bitmap,
                rectsToMask,
                logger,
            )
        }
    }

    /**
     * Compresses a bitmap using the optimal format for the current Android version.
     * Returns a Pair of (file extension, compressed bytes) or null if compression fails.
     */
    fun compressBitmap(
        bitmap: Bitmap,
        quality: Int,
        logger: Logger,
    ): Pair<String, ByteArray>? {
        return try {
            ByteArrayOutputStream().use { byteArrayOutputStream ->
                val extension = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    bitmap.compress(
                        Bitmap.CompressFormat.WEBP_LOSSY,
                        quality,
                        byteArrayOutputStream,
                    )
                    "webp"
                } else {
                    bitmap.compress(
                        Bitmap.CompressFormat.JPEG,
                        quality,
                        byteArrayOutputStream,
                    )
                    "jpeg"
                }

                if (byteArrayOutputStream.size() <= 0) {
                    logger.log(LogLevel.Debug, "Screenshot is 0 bytes, discarding")
                    return null
                }

                Pair(extension, byteArrayOutputStream.toByteArray())
            }
        } catch (e: Throwable) {
            logger.log(LogLevel.Error, "Failed to take screenshot, compression failed", e)
            null
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun captureBitmapUsingPixelCopy(
        window: Window,
        bitmap: Bitmap,
        rectsToMask: List<Rect>,
        logger: Logger,
    ): Bitmap? {
        val thread = HandlerThread(HANDLER_THREAD_NAME).apply { start() }
        val handler = Handler(thread.looper)

        return try {
            val latch = CountDownLatch(1)
            var pixelCopyResult: Bitmap? = null

            PixelCopy.request(window, bitmap, { copyResult ->
                if (copyResult == PixelCopy.SUCCESS) {
                    pixelCopyResult = bitmap.apply {
                        if (rectsToMask.isNotEmpty()) {
                            maskRects(this, rectsToMask)
                        }
                    }
                } else {
                    logger.log(LogLevel.Error, "PixelCopy request failed with result: $copyResult")
                }
                latch.countDown()
            }, handler)

            latch.await(PIXEL_COPY_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            pixelCopyResult
        } catch (e: Throwable) {
            logger.log(LogLevel.Error, "Failed to take screenshot using PixelCopy", e)
            null
        } finally {
            thread.quitSafely()
        }
    }

    private fun captureBitmapUsingCanvas(
        activity: Activity,
        view: View,
        bitmap: Bitmap,
        rectsToMask: List<Rect>,
        logger: Logger,
        onMainThreadCallback: ((Canvas) -> Unit)? = null,
    ): Bitmap {
        try {
            val canvas = Canvas(bitmap)
            if (isMainThread()) {
                view.draw(canvas)
                if (rectsToMask.isNotEmpty()) {
                    maskRects(bitmap, rectsToMask)
                }
                onMainThreadCallback?.invoke(canvas)
            } else {
                activity.runOnUiThread {
                    view.draw(canvas)
                    if (rectsToMask.isNotEmpty()) {
                        maskRects(bitmap, rectsToMask)
                    }
                    onMainThreadCallback?.invoke(canvas)
                }
            }
        } catch (e: Throwable) {
            logger.log(LogLevel.Error, "Failed to take screenshot using canvas", e)
        }
        return bitmap
    }

    private fun maskRects(bitmap: Bitmap, rectsToMask: List<Rect>) {
        val canvas = Canvas(bitmap)
        rectsToMask.forEach { rect ->
            val rectF = RectF(rect)
            canvas.clipRect(rectF)
            canvas.drawRoundRect(rectF, DEFAULT_MASK_RADIUS, DEFAULT_MASK_RADIUS, maskPaint)
        }
    }

    private fun isMainThread(): Boolean {
        return Thread.currentThread() == Looper.getMainLooper().thread
    }
}
