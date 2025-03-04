package sh.measure.android.bugreport

import android.Manifest
import android.app.Activity
import android.app.Activity.RESULT_OK
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.widget.Toast
import sh.measure.android.SessionManager
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.BugReportCollector.Companion.MAX_OUTPUT_IMAGE_WIDTH
import sh.measure.android.bugreport.BugReportCollector.Companion.PICK_IMAGES_REQUEST
import sh.measure.android.bugreport.BugReportCollector.Companion.READ_IMAGES_PERMISSION_REQUEST
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
import kotlin.math.roundToInt
import sh.measure.android.events.Attachment as EventAttachment

internal interface BugReportCollector {
    companion object {
        const val PICK_IMAGES_REQUEST = 1
        const val READ_IMAGES_PERMISSION_REQUEST = 2
        const val INITIAL_SCREENSHOT_EXTRA = "msr_br_screenshot"
        const val MAX_ATTACHMENTS_EXTRA = "msr_br_max_attachments"
        const val MAX_DESCRIPTION_LENGTH = "msr_br_description_length"
        const val MAX_OUTPUT_IMAGE_WIDTH = 1080
    }

    fun startBugReportFlow(
        takeScreenshot: Boolean = true,
        attributes: MutableMap<String, AttributeValue>? = null,
    )
    fun launchImagePicker(activity: Activity, maxAllowedSelections: Int)
    fun onImagePickedResult(
        context: Context,
        resultCode: Int,
        data: Intent?,
        maxAllowedSelections: Int,
    ): List<Uri>

    fun track(
        context: Context,
        description: String,
        parcelableAttachments: List<ParcelableAttachment>,
        uris: List<Uri>,
    )

    fun validateBugReport(attachments: Int, descriptionLength: Int): Boolean
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

    override fun startBugReportFlow(
        takeScreenshot: Boolean,
        attributes: MutableMap<String, AttributeValue>?,
    ) {
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

    override fun launchImagePicker(activity: Activity, maxAllowedSelections: Int) {
        when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> {
                checkPermissionAndLaunchImagePicker(
                    activity,
                    Manifest.permission.READ_MEDIA_IMAGES,
                )
            }

            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M -> {
                checkPermissionAndLaunchImagePicker(
                    activity,
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                )
            }

            else -> {
                launchImagePickerIntent(activity)
            }
        }
    }

    override fun onImagePickedResult(
        context: Context,
        resultCode: Int,
        data: Intent?,
        maxAllowedSelections: Int,
    ): List<Uri> {
        if (resultCode == RESULT_OK) {
            val selectedUris = mutableListOf<Uri>()
            val clipData = data?.clipData
            if (clipData != null) {
                for (i in 0 until minOf(clipData.itemCount, maxAllowedSelections)) {
                    val uri = clipData.getItemAt(i).uri
                    try {
                        context.contentResolver.takePersistableUriPermission(
                            uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION,
                        )
                        selectedUris.add(uri)
                    } catch (e: SecurityException) {
                        logger.log(LogLevel.Error, "Failed to take permission for URI: $uri", e)
                    }
                }
            } else {
                val uri = data?.data
                if (uri != null) {
                    try {
                        context.contentResolver.takePersistableUriPermission(
                            uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION,
                        )
                        selectedUris.add(uri)
                    } catch (e: SecurityException) {
                        logger.log(LogLevel.Error, "Failed to take permission for URI: $uri", e)
                    }
                }
            }
            return selectedUris
        }
        return listOf()
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
                        )
                        sessionManager.markSessionWithBugReport()
                    },
                )
            } catch (e: Exception) {
                logger.log(LogLevel.Error, "Failed to track bug report", e)
            }
        }
    }

    override fun validateBugReport(attachments: Int, descriptionLength: Int): Boolean {
        return attachments > 0 || descriptionLength > 0
    }

    private fun launchImagePickerIntent(activity: Activity) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "image/*"
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        try {
            activity.startActivityForResult(intent, PICK_IMAGES_REQUEST)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(activity, "No app available to open images", Toast.LENGTH_LONG).show()
        }
    }

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
                } catch (e: RejectedExecutionException) {
                    onError()
                }
            },
        )
    }

    private fun checkPermissionAndLaunchImagePicker(
        activity: Activity,
        permission: String,
        requestCode: Int = READ_IMAGES_PERMISSION_REQUEST,
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            when {
                activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED -> {
                    launchImagePickerIntent(activity)
                }

                else -> {
                    activity.requestPermissions(arrayOf(permission), requestCode)
                }
            }
        } else {
            launchImagePickerIntent(activity)
        }
    }

    private fun List<ParcelableAttachment>.toEventAttachments(): List<EventAttachment> {
        return mapNotNull { attachment: ParcelableAttachment ->
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
    }

    private fun List<Uri>.toEventAttachments(context: Context): List<EventAttachment> {
        return mapNotNull { uri ->
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
}
