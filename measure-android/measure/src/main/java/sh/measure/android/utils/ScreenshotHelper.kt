package sh.measure.android.utils

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.view.PixelCopy
import android.view.View
import android.view.Window
import androidx.annotation.RequiresApi
import sh.measure.android.isMainThread
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.ByteArrayOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

internal interface ScreenshotHelper {
    /**
     * Attempts to take a screenshot of the visible activity, if any.
     *
     * @return The screenshot as a PNG byte array, or null if the screenshot could not be taken.
     */
    fun takeScreenshot(): ByteArray?
}

/**
 * Helper class to capture a screenshot of the currently resumed activity. The screenshot is
 * captured using the PixelCopy API on Android O and above, and using the Canvas API on older
 * versions. The returned screenshot is compressed to a PNG byte array.
 */
internal class ScreenshotHelperImpl(
    private val logger: Logger,
    private val resumedActivityProvider: ResumedActivityProvider,
) : ScreenshotHelper {
    // Timeout for capturing the screenshot in milliseconds.
    // After this time, the screenshot will be considered failed.
    private val captureTimeout: Long = 1000

    override fun takeScreenshot(): ByteArray? {
        return resumedActivityProvider.getResumedActivity()?.let {
            takeScreenshot(it)
        }
    }

    private fun takeScreenshot(activity: Activity): ByteArray? {
        if (!isActivityAlive(activity)) {
            logger.log(LogLevel.Debug, "Unable to take screenshot, activity is unavailable.")
            return null
        }
        val bitmap = captureBitmap(activity) ?: return null
        return compressBitmap(bitmap)
    }

    private fun captureBitmap(activity: Activity): Bitmap? {
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

        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            captureBitmapUsingPixelCopy(window, bitmap)
        } else {
            captureBitmapUsingCanvas(activity, view, bitmap)
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun captureBitmapUsingPixelCopy(window: Window, bitmap: Bitmap): Bitmap? {
        val latch = CountDownLatch(1)
        val copyResultSuccess = AtomicBoolean(false)
        val thread = HandlerThread("msr-pixel-copy")
        thread.start()

        try {
            val handler = Handler(thread.looper)
            PixelCopy.request(window, bitmap, { copyResult ->
                copyResultSuccess.set(copyResult == PixelCopy.SUCCESS)
                latch.countDown()
            }, handler)
            if (!latch.await(captureTimeout, TimeUnit.MILLISECONDS) || !copyResultSuccess.get()) {
                return null
            }
        } catch (e: Throwable) {
            logger.log(LogLevel.Error, "Failed to take screenshot using PixelCopy", e)
            return null
        } finally {
            thread.quit()
        }

        return bitmap
    }

    private fun captureBitmapUsingCanvas(activity: Activity, view: View, bitmap: Bitmap): Bitmap? {
        val latch = CountDownLatch(1)

        try {
            if (isMainThread()) {
                view.draw(Canvas(bitmap))
                latch.countDown()
            } else {
                activity.runOnUiThread {
                    view.draw(Canvas(bitmap))
                }
            }
        } catch (e: Throwable) {
            logger.log(LogLevel.Error, "Failed to take screenshot using canvas", e)
        } finally {
            latch.countDown()
        }

        if (!latch.await(captureTimeout, TimeUnit.MILLISECONDS)) {
            return null
        }

        return bitmap
    }

    private fun compressBitmap(bitmap: Bitmap): ByteArray? {
        try {
            ByteArrayOutputStream().use { byteArrayOutputStream ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 0, byteArrayOutputStream)
                if (byteArrayOutputStream.size() <= 0) {
                    logger.log(LogLevel.Debug, "Screenshot is 0 bytes, not attaching the image")
                    return null
                }
                return byteArrayOutputStream.toByteArray()
            }
        } catch (e: Throwable) {
            logger.log(LogLevel.Error, "Failed to take screenshot, compression to PNG failed", e)
            return null
        }
    }

    private fun isActivityAlive(activity: Activity): Boolean {
        return !activity.isFinishing && !activity.isDestroyed
    }
}
