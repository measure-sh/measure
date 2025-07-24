package sh.measure.android.screenshot

import android.app.Activity
import sh.measure.android.config.ConfigProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.BitmapHelper
import sh.measure.android.utils.LowMemoryCheck
import sh.measure.android.utils.ResumedActivityProvider
import sh.measure.android.utils.ScreenshotMaskConfig

internal class Screenshot(
    val data: ByteArray,
    val extension: String,
)

internal interface ScreenshotCollector {
    /**
     * Attempts to take a screenshot of the visible activity, if any.
     *
     * @return The screenshot as a byte array, or null if the screenshot could not be taken.
     */
    fun takeScreenshot(): Screenshot?
}

/**
 * Captures a screenshot of the currently resumed activity, given the system memory is not running
 * low. The screenshot is captured using the PixelCopy API on Android O and above, and using
 * the Canvas API on older versions. The returned screenshot is compressed webp on supported
 * versions with a fallback to JPEG.
 *
 * The screenshot is masked to hide sensitive text and can also be configured to mask all text.
 */
internal class ScreenshotCollectorImpl(
    private val logger: Logger,
    private val resumedActivityProvider: ResumedActivityProvider,
    private val lowMemoryCheck: LowMemoryCheck,
    private val config: ConfigProvider,
) : ScreenshotCollector {

    override fun takeScreenshot(): Screenshot? {
        if (lowMemoryCheck.isLowMemory()) {
            logger.log(LogLevel.Debug, "Unable to take screenshot, system has low memory.")
            return null
        }

        return resumedActivityProvider.getResumedActivity()?.let { activity ->
            if (!isActivityAlive(activity)) {
                logger.log(LogLevel.Debug, "Unable to take screenshot, activity is unavailable.")
                return null
            }
            val maskConfig = ScreenshotMaskConfig(
                maskHexColor = config.screenshotMaskHexColor,
                getMaskRects = { view ->
                    ScreenshotMask(config).findRectsToMask(view)
                },
            )
            val bitmap = BitmapHelper.captureBitmap(
                activity = activity,
                logger = logger,
                screenshotMaskConfig = maskConfig,
            ) ?: return null
            val (extension, compressed) = BitmapHelper.compressBitmap(
                bitmap = bitmap,
                quality = config.screenshotCompressionQuality,
                logger = logger,
            ) ?: return null
            Screenshot(data = compressed, extension = extension)
        }
    }

    private fun isActivityAlive(activity: Activity): Boolean = !activity.isFinishing && !activity.isDestroyed
}
