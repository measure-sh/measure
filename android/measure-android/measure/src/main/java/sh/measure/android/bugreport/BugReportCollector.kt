package sh.measure.android.bugreport

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import sh.measure.android.SessionManager
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.BugReportCollector.Companion.MAX_OUTPUT_IMAGE_WIDTH
import sh.measure.android.bugreport.BugReportCollector.Companion.MAX_PREVIEW_IMAGE_SIZE
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.AttachmentType
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.mainHandler
import sh.measure.android.screenshot.ScreenshotMask
import sh.measure.android.storage.FileStorage
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.BitmapHelper
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.ResumedActivityProvider
import sh.measure.android.utils.ScreenshotMaskConfig
import sh.measure.android.utils.TimeProvider
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.Callable
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt
import sh.measure.android.events.Attachment as EventAttachment

internal interface BugReportCollector {
    companion object {
        const val MAX_ATTACHMENTS_EXTRA = "msr_br_max_attachments"
        const val MAX_DESCRIPTION_LENGTH = "msr_br_description_length"
        const val MAX_OUTPUT_IMAGE_WIDTH = 1080
        const val MAX_PREVIEW_IMAGE_SIZE = 1024
    }

    fun startBugReportFlow(
        takeScreenshot: Boolean = true,
        attributes: MutableMap<String, AttributeValue>? = null,
    )

    fun track(
        context: Context,
        description: String,
        parcelableAttachments: List<ParcelableAttachment>,
        uris: List<Uri>,
    )

    fun validateBugReport(attachments: Int, descriptionLength: Int): Boolean
    fun setBugReportFlowActive()
    fun setBugReportFlowInactive()
    fun getPendingScreenshot(): PendingScreenshot?
    fun discardPendingScreenshot(screenshot: PendingScreenshot)
}

internal class BugReportCollectorImpl internal constructor(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val ioExecutor: MeasureExecutorService,
    private val fileStorage: FileStorage,
    private val idProvider: IdProvider,
    private val configProvider: ConfigProvider,
    private val sessionManager: SessionManager,
    private val resumedActivityProvider: ResumedActivityProvider,
) : BugReportCollector {
    private var attributes: MutableMap<String, AttributeValue>? = null
    private var pendingScreenshot: PendingScreenshot? = null
    private val isBugReportFlowActive = AtomicBoolean(false)

    override fun startBugReportFlow(
        takeScreenshot: Boolean,
        attributes: MutableMap<String, AttributeValue>?,
    ) {
        if (isBugReportFlowActive.get()) {
            logger.log(LogLevel.Debug, "Bug report flow already active, skipping launch")
            return
        }
        this.attributes = attributes
        val activity = resumedActivityProvider.getResumedActivity() ?: return
        pendingScreenshot?.discard()
        pendingScreenshot = if (takeScreenshot) captureScreenshot(activity) else null
        MsrBugReportActivity.launch(
            activity,
            configProvider.maxAttachmentsInBugReport,
            configProvider.maxDescriptionLengthInBugReport,
        )
    }

    override fun getPendingScreenshot(): PendingScreenshot? = pendingScreenshot

    override fun discardPendingScreenshot(screenshot: PendingScreenshot) {
        if (pendingScreenshot === screenshot) {
            pendingScreenshot = null
        }
        screenshot.discard()
    }

    override fun setBugReportFlowActive() {
        isBugReportFlowActive.compareAndSet(false, true)
    }

    override fun setBugReportFlowInactive() {
        isBugReportFlowActive.compareAndSet(true, false)
    }

    override fun track(
        context: Context,
        description: String,
        parcelableAttachments: List<ParcelableAttachment>,
        uris: List<Uri>,
    ) {
        val timestamp = timeProvider.now()
        val threadName = Thread.currentThread().name
        val appContextRef = WeakReference(context.applicationContext)
        val screenshot = pendingScreenshot?.takeIf { it.isEncoding() }
        pendingScreenshot = null
        ioExecutor.submit {
            try {
                InternalTrace.trace(
                    label = {
                        "mrs-track-bug-report"
                    },
                    block = {
                        val appContext = appContextRef.get() ?: return@trace
                        val pending = listOfNotNull(screenshot?.awaitEncoded())
                        val eventAttachments =
                            (parcelableAttachments + pending).toEventAttachments() +
                                uris.toEventAttachments(appContext)
                        signalProcessor.track(
                            data = BugReportData(description = description),
                            timestamp = timestamp,
                            type = EventType.BUG_REPORT,
                            attachments = eventAttachments.toMutableList(),
                            threadName = threadName,
                            userDefinedAttributes = attributes ?: mutableMapOf(),
                            isSampled = true,
                        )
                    },
                )
            } catch (e: Exception) {
                logger.log(LogLevel.Error, "Failed to track bug report", e)
            }
        }
    }

    override fun validateBugReport(attachments: Int, descriptionLength: Int): Boolean = attachments > 0 || descriptionLength > 0

    /**
     * Captures the screen being reported, which has to happen before the bug report window covers
     * it, and leaves encoding to the IO executor so that the screen can be shown straight away.
     */
    private fun captureScreenshot(activity: Activity): PendingScreenshot? {
        val bitmap = InternalTrace.trace("msr-captureScreenshot") {
            val screenshotMaskConfig = ScreenshotMaskConfig(
                maskHexColor = configProvider.screenshotMaskHexColor,
                getMaskRects = { view ->
                    ScreenshotMask(configProvider).findRectsToMask(view)
                },
            )
            BitmapHelper.captureBitmap(activity, logger, screenshotMaskConfig)
        } ?: return null
        val preview = scalePreview(bitmap) ?: return null
        val screenshot = PendingScreenshot(preview)
        return try {
            screenshot.encoding = ioExecutor.submit(
                Callable {
                    val encoded = encodeScreenshot(bitmap)
                    screenshot.recordEncoded(encoded)
                    mainHandler.post { screenshot.finishEncoding(encoded) }
                    encoded
                },
            )
            screenshot
        } catch (_: RejectedExecutionException) {
            null
        }
    }

    private fun encodeScreenshot(bitmap: Bitmap): ParcelableAttachment? = InternalTrace.trace("msr-encodeScreenshot") {
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
        ParcelableAttachment(name = "screenshot.$extension", path = path)
    }

    /**
     * The bug report screen shows a thumbnail, so the full size bitmap is never handed to it.
     */
    private fun scalePreview(bitmap: Bitmap): Bitmap? = InternalTrace.trace("msr-scalePreview") {
        val longestSide = maxOf(bitmap.width, bitmap.height)
        val scale = if (longestSide <= MAX_PREVIEW_IMAGE_SIZE) {
            1f
        } else {
            MAX_PREVIEW_IMAGE_SIZE.toFloat() / longestSide
        }
        try {
            Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * scale).roundToInt().coerceAtLeast(1),
                (bitmap.height * scale).roundToInt().coerceAtLeast(1),
                true,
            )
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to scale bug report screenshot", e)
            null
        }
    }

    private fun List<ParcelableAttachment>.toEventAttachments(): List<EventAttachment> = mapNotNull { attachment: ParcelableAttachment ->
        val file = File(attachment.path)
        if (file.exists()) {
            val bytes = file.readBytes()
            EventAttachment(
                name = attachment.name,
                type = AttachmentType.SCREENSHOT,
                bytes = bytes,
            )
        } else {
            null
        }
    }

    private fun List<Uri>.toEventAttachments(context: Context): List<EventAttachment> = mapNotNull { uri ->
        try {
            val contentResolver = context.contentResolver
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            contentResolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, options)
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
}
