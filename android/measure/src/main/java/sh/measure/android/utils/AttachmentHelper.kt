package sh.measure.android.utils

import android.app.Activity
import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.annotation.MainThread
import sh.measure.android.MsrAttachment
import sh.measure.android.bugreport.BugReportCollector.Companion.MAX_OUTPUT_IMAGE_WIDTH
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.AttachmentType
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.layoutinspector.LayoutInspector
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.mainHandler
import sh.measure.android.screenshot.ScreenshotMask
import java.lang.ref.WeakReference
import java.util.concurrent.RejectedExecutionException
import kotlin.math.roundToInt

internal class AttachmentHelper(
    private val logger: Logger,
    private val ioExecutor: MeasureExecutorService,
    private val configProvider: ConfigProvider,
) {

    /**
     * Captures a screenshot of the given activity and processes it asynchronously.
     * The screenshot is compressed, and returned as an attachment.
     *
     * Note that this function must be called from main thread, the callbacks are also called
     * on the main thread.
     *
     * @param activity The activity to capture the screenshot from
     * @param onCaptured Callback invoked with the created attachment when screenshot is successfully captured and processed
     * @param onError Callback invoked if any error occurs during capture or compression.
     */
    @MainThread
    fun captureScreenshot(
        activity: Activity,
        onCaptured: (attachment: MsrAttachment) -> Unit,
        onError: (() -> Unit)?,
    ) {
        val screenshotMaskConfig = ScreenshotMaskConfig(
            maskHexColor = configProvider.screenshotMaskHexColor,
            getMaskRects = { view ->
                ScreenshotMask(configProvider).findRectsToMask(view)
            },
        )
        val bitmap = BitmapHelper.captureBitmap(activity, logger, screenshotMaskConfig)
        if (bitmap == null) {
            onError?.invoke()
            return
        }
        try {
            ioExecutor.submit {
                val result = BitmapHelper.compressBitmap(
                    bitmap,
                    configProvider.screenshotCompressionQuality,
                    logger,
                )
                if (result == null) {
                    mainHandler.post { onError?.invoke() }
                } else {
                    mainHandler.post {
                        val (extension, bytes) = result
                        onCaptured(
                            MsrAttachment(
                                "screenshot.$extension",
                                bytes = bytes,
                                type = AttachmentType.SCREENSHOT,
                            ),
                        )
                    }
                }
            }
        } catch (e: RejectedExecutionException) {
            onError?.invoke()
        }
    }

    @MainThread
    fun captureLayoutSnapshot(
        activity: Activity,
        onComplete: (attachment: MsrAttachment) -> Unit,
        onError: (() -> Unit)?,
    ) {
        val window = activity.window ?: run {
            logger.log(LogLevel.Debug, "Failed to take screenshot, window is null")
            onError?.invoke()
            return
        }

        val decorView = window.peekDecorView() ?: run {
            logger.log(LogLevel.Debug, "Failed to take screenshot, decor view is null")
            onError?.invoke()
            return
        }

        val view = decorView.rootView ?: run {
            logger.log(LogLevel.Debug, "Failed to take screenshot, root view is null")
            onError?.invoke()
            return
        }

        val width = view.width
        val height = view.height
        if (width <= 0 || height <= 0) {
            logger.log(LogLevel.Debug, "Failed to take screenshot, invalid view bounds")
            onError?.invoke()
            return
        }
        val snapshot = LayoutInspector.capture(view)
        onComplete(snapshot.generateSvgMsrAttachment(null, width, height))
    }

    fun imageUriToAttachment(
        context: Context,
        uri: Uri,
        onComplete: (attachment: MsrAttachment) -> Unit,
        onError: (() -> Unit)?,
    ) {
        try {
            val contextRef = WeakReference(context)
            ioExecutor.submit {
                try {
                    val contentResolver = contextRef.get()?.contentResolver ?: run {
                        logger.log(
                            LogLevel.Error,
                            "Failed to read uri: context is no longer available",
                        )
                        onError?.let { mainHandler.post(it) }
                        return@submit
                    }

                    val options = BitmapFactory.Options().apply {
                        inJustDecodeBounds = true
                    }
                    val firstDecodeFailed = contentResolver.openInputStream(uri)?.use {
                        BitmapFactory.decodeStream(it, null, options)
                    } == null

                    if (firstDecodeFailed) {
                        logger.log(
                            LogLevel.Error,
                            "Failed to read uri: image may be corrupted or in unsupported format.",
                        )
                        onError?.let { mainHandler.post(it) }
                        return@submit
                    }
                    val sampleSize = if (options.outWidth > MAX_OUTPUT_IMAGE_WIDTH) {
                        (options.outWidth.toFloat() / MAX_OUTPUT_IMAGE_WIDTH.toFloat()).roundToInt()
                    } else {
                        1
                    }
                    options.apply {
                        inJustDecodeBounds = false
                        inSampleSize = sampleSize
                    }
                    val bitmap = contentResolver.openInputStream(uri)?.use {
                        BitmapFactory.decodeStream(it, null, options)
                    }
                    if (bitmap == null) {
                        logger.log(LogLevel.Error, "Failed to read uri: unable to decode image")
                        onError?.let { mainHandler.post(it) }
                        return@submit
                    }
                    val compressed = BitmapHelper.compressBitmap(
                        bitmap,
                        configProvider.screenshotCompressionQuality,
                        logger,
                    )
                    if (compressed == null) {
                        logger.log(LogLevel.Error, "Failed to read uri: unable to compress bitmap")
                        onError?.let { mainHandler.post(it) }
                        return@submit
                    }
                    val (extension, bytes) = compressed
                    mainHandler.post {
                        onComplete(
                            MsrAttachment(
                                name = "screenshot.$extension",
                                bytes = bytes,
                                type = AttachmentType.SCREENSHOT,
                            ),
                        )
                    }
                } catch (e: Exception) {
                    onError?.let { mainHandler.post(it) }
                }
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Failed to read uri: unexpected error", e)
            onError?.invoke()
        }
    }
}
