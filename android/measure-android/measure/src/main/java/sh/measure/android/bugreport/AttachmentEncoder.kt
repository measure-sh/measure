package sh.measure.android.bugreport

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import sh.measure.android.SessionManager
import sh.measure.android.bugreport.AttachmentEncoder.Companion.MAX_PREVIEW_IMAGE_SIZE
import sh.measure.android.bugreport.AttachmentEncoder.Companion.sampleSizeFor
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.AttachmentType
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.screenshot.ScreenshotMask
import sh.measure.android.storage.FileStorage
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.BitmapHelper
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.ScreenshotMaskConfig
import kotlin.math.roundToInt
import sh.measure.android.events.Attachment as EventAttachment

internal interface AttachmentEncoder {
    companion object {
        const val MAX_OUTPUT_IMAGE_WIDTH = 1080
        const val MAX_PREVIEW_IMAGE_SIZE = 1024

        fun sampleSizeFor(width: Int): Int {
            var sampleSize = 1
            while (width / sampleSize > MAX_OUTPUT_IMAGE_WIDTH) {
                sampleSize *= 2
            }
            return sampleSize
        }
    }

    fun capture(activity: Activity): Bitmap?

    fun scalePreview(bitmap: Bitmap): Bitmap?

    fun encodeScreenshot(bitmap: Bitmap): EncodedScreenshot?

    fun encodeImage(context: Context, uri: Uri): EventAttachment?

    fun deleteScreenshot(path: String)
}

internal class AttachmentEncoderImpl(
    private val logger: Logger,
    private val configProvider: ConfigProvider,
    private val fileStorage: FileStorage,
    private val idProvider: IdProvider,
    private val sessionManager: SessionManager,
) : AttachmentEncoder {
    override fun capture(activity: Activity): Bitmap? = InternalTrace.trace("msr-captureScreenshot") {
        val screenshotMaskConfig = ScreenshotMaskConfig(
            maskHexColor = configProvider.screenshotMaskHexColor,
            getMaskRects = { view ->
                ScreenshotMask(configProvider).findRectsToMask(view)
            },
        )
        BitmapHelper.captureBitmap(activity, logger, screenshotMaskConfig)
    }

    override fun encodeScreenshot(bitmap: Bitmap): EncodedScreenshot? = InternalTrace.trace("msr-encodeScreenshot") {
        try {
            val (extension, bytes) = BitmapHelper.compressBitmap(
                bitmap,
                configProvider.screenshotCompressionQuality,
                logger,
            ) ?: return@trace null
            val path = fileStorage.writeTempBugReportScreenshot(
                idProvider.uuid(),
                extension,
                bytes,
                sessionManager.getSessionId(),
            ) ?: return@trace null
            EncodedScreenshot(name = "screenshot.$extension", path = path)
        } finally {
            bitmap.recycle()
        }
    }

    override fun deleteScreenshot(path: String) {
        fileStorage.deleteFilePaths(listOf(path))
    }

    override fun scalePreview(bitmap: Bitmap): Bitmap? = InternalTrace.trace("msr-scalePreview") {
        val longestSide = maxOf(bitmap.width, bitmap.height)
        val scale = if (longestSide <= MAX_PREVIEW_IMAGE_SIZE) {
            1f
        } else {
            MAX_PREVIEW_IMAGE_SIZE.toFloat() / longestSide
        }
        val width = (bitmap.width * scale).roundToInt().coerceAtLeast(1)
        val height = (bitmap.height * scale).roundToInt().coerceAtLeast(1)
        try {
            if (width == bitmap.width && height == bitmap.height) {
                bitmap.copy(bitmap.config ?: Bitmap.Config.ARGB_8888, false)
            } else {
                Bitmap.createScaledBitmap(bitmap, width, height, true)
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to scale bug report screenshot", e)
            null
        }
    }

    override fun encodeImage(context: Context, uri: Uri): EventAttachment? = try {
        val contentResolver = context.contentResolver
        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, options)
        }
        val sampleSize = sampleSizeFor(options.outWidth)
        options.apply {
            inJustDecodeBounds = false
            inSampleSize = sampleSize
        }
        contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, options)
        }?.let { bitmap ->
            BitmapHelper.compressBitmap(
                bitmap,
                configProvider.screenshotCompressionQuality,
                logger,
            )?.let { (extension, bytes) ->
                EventAttachment(
                    name = "screenshot.$extension",
                    bytes = bytes,
                    type = AttachmentType.SCREENSHOT,
                )
            }
        }
    } catch (e: Exception) {
        logger.log(LogLevel.Error, "Failed to read image from URI: $uri", e)
        null
    }
}
