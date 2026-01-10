package sh.measure.android.bugreport

import android.app.Activity
import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import sh.measure.android.SessionManager
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.BugReportCollector.Companion.MAX_OUTPUT_IMAGE_WIDTH
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.AttachmentType
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.BitmapHelper
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.ResumedActivityProvider
import sh.measure.android.utils.TimeProvider
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt
import sh.measure.android.events.Attachment as EventAttachment

internal interface BugReportCollector {
    companion object {
        const val INITIAL_SCREENSHOT_EXTRA = "msr_br_screenshot"
        const val MAX_ATTACHMENTS_EXTRA = "msr_br_max_attachments"
        const val MAX_DESCRIPTION_LENGTH = "msr_br_description_length"
        const val MAX_OUTPUT_IMAGE_WIDTH = 1080
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
        fun launchActivity(initialAttachment: ParcelableAttachment?) {
            MsrBugReportActivity.launch(
                activity,
                initialAttachment,
                configProvider.maxAttachmentsInBugReport,
                configProvider.maxDescriptionLengthInBugReport,
            )
        }
        if (takeScreenshot) {
            captureScreenshot(activity = activity, onSuccess = { screenshot ->
                launchActivity(screenshot)
            }, onError = {
                launchActivity(null)
            })
        } else {
            launchActivity(null)
        }
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
        ioExecutor.submit {
            try {
                InternalTrace.trace(
                    label = {
                        "mrs-track-bug-report"
                    },
                    block = {
                        val appContext = appContextRef.get() ?: return@trace
                        val eventAttachments =
                            parcelableAttachments.toEventAttachments() + uris.toEventAttachments(
                                appContext,
                            )
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

    private fun captureScreenshot(
        activity: Activity,
        onSuccess: (ParcelableAttachment) -> Unit,
        onError: () -> Unit,
    ) {
        InternalTrace.trace(
            label = {
                "msr-captureScreenshot"
            },
            block = {
                val bitmap = BitmapHelper.captureBitmap(activity, logger)
                if (bitmap == null) {
                    onError()
                    return@trace
                }

                try {
                    ioExecutor.submit {
                        val compressedBitmap = BitmapHelper.compressBitmap(
                            bitmap,
                            configProvider.screenshotCompressionQuality,
                            logger,
                        )
                        if (compressedBitmap == null) {
                            activity.runOnUiThread { onError() }
                            return@submit
                        }
                        val id = idProvider.uuid()
                        val path = fileStorage.writeTempBugReportScreenshot(
                            id,
                            compressedBitmap.first,
                            compressedBitmap.second,
                            sessionManager.getSessionId(),
                        )
                        if (path == null) {
                            activity.runOnUiThread { onError() }
                            return@submit
                        }
                        val parcelableAttachment = ParcelableAttachment(name = id, path = path)
                        activity.runOnUiThread { onSuccess(parcelableAttachment) }
                    }
                } catch (_: RejectedExecutionException) {
                    onError()
                }
            },
        )
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
