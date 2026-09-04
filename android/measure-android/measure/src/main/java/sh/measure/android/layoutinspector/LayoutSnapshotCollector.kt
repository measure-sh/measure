package sh.measure.android.layoutinspector

import android.view.View
import android.view.ViewTreeObserver
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
    fun captureAttachment(onCaptured: (Attachment?) -> Unit)
    fun captureAttachmentAfterNextDraw(onCaptured: (Attachment?) -> Unit)
    fun captureAttachmentAfterNextDraw(window: Window, onCaptured: (Attachment?) -> Unit)
    fun captureAttachmentAfterPendingLayout(onCaptured: (Attachment?) -> Unit)
}

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
            captureAttachmentFrom(Curtains.rootViews.lastOrNull(), onCaptured)
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
                    captureAttachmentFrom(window.peekDecorView()?.rootView, onCaptured)
                }
            }
        }
    }

    override fun captureAttachmentAfterPendingLayout(onCaptured: (Attachment?) -> Unit) {
        runOnMainThread {
            val decorView = resumedActivityProvider.getResumedActivity()?.window?.peekDecorView()
            if (decorView == null) {
                onCaptured(null)
                return@runOnMainThread
            }
            if (!layoutSnapshotThrottler.shouldTakeSnapshot()) {
                onCaptured(null)
                return@runOnMainThread
            }
            if (decorView.isLayoutRequested) {
                onNextLayout(decorView) {
                    captureAttachmentFrom(decorView.rootView, onCaptured)
                }
            } else {
                captureAttachmentFrom(decorView.rootView, onCaptured)
            }
        }
    }

    private fun onNextLayout(decorView: View, onLaidOut: () -> Unit) {
        decorView.viewTreeObserver.addOnGlobalLayoutListener(
            object : ViewTreeObserver.OnGlobalLayoutListener {
                override fun onGlobalLayout() {
                    val observer = decorView.viewTreeObserver
                    if (observer.isAlive) {
                        observer.removeOnGlobalLayoutListener(this)
                    }
                    mainHandler.post(onLaidOut)
                }
            },
        )
    }

    private fun captureAttachmentFrom(rootView: View?, onCaptured: (Attachment?) -> Unit) {
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
