package sh.measure.android.layoutinspector

import android.view.View
import android.view.Window
import curtains.Curtains
import curtains.onNextDraw
import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.isMainThread
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.mainHandler
import sh.measure.android.utils.ResumedActivityProvider
import java.util.concurrent.RejectedExecutionException

internal interface LayoutSnapshotCollector {
    /**
     * Compresses a layout snapshot of the top-most window into an attachment and delivers it on
     * the main thread, or delivers null when no snapshot could be taken.
     */
    fun captureAttachment(onCaptured: (Attachment?) -> Unit)

    /**
     * Same as [captureAttachment], but waits until the resumed activity's next frame has been
     * drawn so that a screen which just appeared has been laid out.
     */
    fun captureAttachmentAfterNextDraw(onCaptured: (Attachment?) -> Unit)

    /**
     * Same as [captureAttachment], but waits until the next frame of [window] has been drawn.
     */
    fun captureAttachmentAfterNextDraw(window: Window, onCaptured: (Attachment?) -> Unit)
}

/**
 * Takes layout snapshots for other collectors to attach to their events.
 */
internal class LayoutSnapshotCollectorImpl(
    private val logger: Logger,
    private val resumedActivityProvider: ResumedActivityProvider,
    private val defaultExecutor: MeasureExecutorService,
    private val layoutSnapshotThrottler: LayoutSnapshotThrottler,
) : LayoutSnapshotCollector {

    override fun captureAttachment(onCaptured: (Attachment?) -> Unit) {
        runOnMainThread {
            if (!layoutSnapshotThrottler.shouldTakeSnapshot()) {
                onCaptured(null)
                return@runOnMainThread
            }
            compress(Curtains.rootViews.lastOrNull(), onCaptured)
        }
    }

    override fun captureAttachmentAfterNextDraw(onCaptured: (Attachment?) -> Unit) {
        runOnMainThread {
            val window = resumedActivityProvider.getResumedActivity()?.window
            if (window == null) {
                onCaptured(null)
            } else {
                captureAttachmentAfterNextDraw(window, onCaptured)
            }
        }
    }

    override fun captureAttachmentAfterNextDraw(window: Window, onCaptured: (Attachment?) -> Unit) {
        runOnMainThread {
            if (!layoutSnapshotThrottler.shouldTakeSnapshot()) {
                onCaptured(null)
                return@runOnMainThread
            }
            // The draw callback runs while the frame is still being drawn, so the capture is
            // posted to run once the frame is complete.
            window.onNextDraw {
                mainHandler.post {
                    compress(window.peekDecorView()?.rootView, onCaptured)
                }
            }
            // Nothing else may redraw after the caller's event, so request a draw.
            window.peekDecorView()?.invalidate()
        }
    }

    private fun compress(rootView: View?, onCaptured: (Attachment?) -> Unit) {
        val snapshot = rootView?.let { view ->
            try {
                LayoutInspector.capture(view)
            } catch (e: Exception) {
                logger.log(LogLevel.Debug, "LayoutSnapshotCollector: unable to parse layout", e)
                null
            }
        }
        if (snapshot == null || snapshot.totalNodeCount() == 0) {
            onCaptured(null)
            return
        }
        try {
            defaultExecutor.submit {
                val attachment =
                    snapshot.compressToAttachment(AttachmentType.LAYOUT_SNAPSHOT_JSON)
                mainHandler.post { onCaptured(attachment) }
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "LayoutSnapshotCollector: failed to compress layout snapshot", e)
            onCaptured(null)
        }
    }

    private fun runOnMainThread(block: () -> Unit) {
        if (isMainThread()) {
            block()
        } else {
            mainHandler.post(block)
        }
    }
}
