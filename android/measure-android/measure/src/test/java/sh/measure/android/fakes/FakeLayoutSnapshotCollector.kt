package sh.measure.android.fakes

import android.view.Window
import sh.measure.android.events.Attachment
import sh.measure.android.layoutinspector.LayoutSnapshotCollector

internal class FakeLayoutSnapshotCollector(var attachment: Attachment? = null) : LayoutSnapshotCollector {
    override fun captureAttachment(onCaptured: (Attachment?) -> Unit) {
        onCaptured(attachment)
    }

    override fun captureAttachmentAfterNextDraw(onCaptured: (Attachment?) -> Unit) {
        onCaptured(attachment)
    }

    override fun captureAttachmentAfterNextDraw(window: Window, onCaptured: (Attachment?) -> Unit) {
        onCaptured(attachment)
    }
}
