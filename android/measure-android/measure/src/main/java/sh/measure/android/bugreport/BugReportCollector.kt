package sh.measure.android.bugreport

import android.app.Activity
import android.content.Context
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.AttachmentType
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.isMainThread
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.mainHandler
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.ResumedActivityProvider
import sh.measure.android.utils.TimeProvider
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.Callable
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import sh.measure.android.events.Attachment as EventAttachment

internal interface BugReportCollector {
    companion object {
        const val MAX_ATTACHMENTS_EXTRA = "msr_br_max_attachments"
        const val MAX_DESCRIPTION_LENGTH = "msr_br_description_length"
    }

    fun startBugReportFlow(
        takeScreenshot: Boolean = true,
        attributes: MutableMap<String, AttributeValue>? = null,
    )

    fun track(
        context: Context,
        description: String,
        attachments: List<BugReportAttachment>,
    )

    fun validateBugReport(attachments: Int, descriptionLength: Int): Boolean
    fun setBugReportFlowActive()
    fun setBugReportFlowInactive()

    fun getSession(): BugReportSession?

    fun discardScreenshot(session: BugReportSession)

    fun discardSession(session: BugReportSession)
}

internal class BugReportCollectorImpl internal constructor(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val ioExecutor: MeasureExecutorService,
    private val configProvider: ConfigProvider,
    private val resumedActivityProvider: ResumedActivityProvider,
    private val attachmentEncoder: AttachmentEncoder,
) : BugReportCollector {
    private val session = AtomicReference<BugReportSession?>(null)
    private val isBugReportFlowActive = AtomicBoolean(false)

    override fun startBugReportFlow(
        takeScreenshot: Boolean,
        attributes: MutableMap<String, AttributeValue>?,
    ) {
        if (!isMainThread()) {
            mainHandler.post { startBugReportFlow(takeScreenshot, attributes) }
            return
        }
        if (isBugReportFlowActive.get()) {
            logger.log(LogLevel.Debug, "Bug report flow already active, skipping launch")
            return
        }
        val activity = resumedActivityProvider.getResumedActivity() ?: return
        val previous = session.getAndSet(null)
        if (previous?.screenshot?.isPreparing() == true) {
            discardScreenshot(previous)
        }
        val screenshot = if (takeScreenshot) captureScreenshot(activity) else null
        session.set(BugReportSession(attributes ?: mutableMapOf(), screenshot))
        MsrBugReportActivity.launch(
            activity,
            configProvider.maxAttachmentsInBugReport,
            configProvider.maxDescriptionLengthInBugReport,
        )
    }

    override fun getSession(): BugReportSession? = session.get()

    override fun discardScreenshot(session: BugReportSession) {
        val slot = session.screenshot ?: return
        if (!slot.discard()) {
            return
        }
        try {
            ioExecutor.submit {
                slot.awaitEncoded()?.let { attachmentEncoder.deleteScreenshot(it.path) }
            }
        } catch (_: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Unable to delete discarded bug report screenshot")
        }
    }

    override fun discardSession(session: BugReportSession) {
        this.session.compareAndSet(session, null)
        discardScreenshot(session)
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
        attachments: List<BugReportAttachment>,
    ) {
        val timestamp = timeProvider.now()
        val threadName = Thread.currentThread().name
        val appContextRef = WeakReference(context.applicationContext)
        val session = this.session.getAndSet(null)
        session?.screenshot?.markConsumed()
        ioExecutor.submit {
            try {
                InternalTrace.trace(
                    label = {
                        "mrs-track-bug-report"
                    },
                    block = {
                        val appContext = appContextRef.get() ?: return@trace
                        val eventAttachments = attachments.mapNotNull { attachment ->
                            when (attachment) {
                                BugReportAttachment.Capture ->
                                    session?.screenshot?.awaitEncoded()?.toEventAttachment()

                                is BugReportAttachment.Screenshot ->
                                    attachment.toEventAttachment()

                                is BugReportAttachment.Image -> attachmentEncoder.encodeImage(
                                    appContext,
                                    attachment.uri,
                                )
                            }
                        }
                        signalProcessor.track(
                            data = BugReportData(description = description),
                            timestamp = timestamp,
                            type = EventType.BUG_REPORT,
                            attachments = eventAttachments.toMutableList(),
                            threadName = threadName,
                            userDefinedAttributes = session?.attributes ?: mutableMapOf(),
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

    private fun captureScreenshot(activity: Activity): ScreenshotSlot? {
        val bitmap = attachmentEncoder.capture(activity) ?: return null
        val preview = attachmentEncoder.scalePreview(bitmap)
        if (preview == null) {
            bitmap.recycle()
            return null
        }
        val slot = ScreenshotSlot(preview)
        return try {
            slot.encodeFuture = ioExecutor.submit(
                Callable {
                    val encoded = attachmentEncoder.encodeScreenshot(bitmap)
                    slot.onEncoded(encoded)
                    mainHandler.post { slot.deliver(encoded) }
                    encoded
                },
            )
            slot
        } catch (_: RejectedExecutionException) {
            null
        }
    }

    private fun EncodedScreenshot.toEventAttachment(): EventAttachment? = BugReportAttachment.Screenshot(name, path).toEventAttachment()

    private fun BugReportAttachment.Screenshot.toEventAttachment(): EventAttachment? {
        val file = File(path)
        if (!file.exists()) {
            return null
        }
        return EventAttachment(
            name = name,
            type = AttachmentType.SCREENSHOT,
            bytes = file.readBytes(),
        )
    }
}
