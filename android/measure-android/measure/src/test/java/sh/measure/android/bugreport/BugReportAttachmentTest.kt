package sh.measure.android.bugreport

import android.net.Uri
import android.os.Parcel
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BugReportAttachmentTest {
    @Test
    fun `attachments survive a parcel round trip`() {
        val uri = Uri.parse("content://media/external/images/media/42")
        val attachments = arrayOf<BugReportAttachment>(
            BugReportAttachment.Capture,
            BugReportAttachment.Screenshot("screenshot.webp", "/tmp/screenshot.webp"),
            BugReportAttachment.Image(uri),
        )

        val parcel = Parcel.obtain()
        parcel.writeParcelableArray(attachments, 0)
        parcel.setDataPosition(0)
        val restored = parcel.readParcelableArray(BugReportAttachment::class.java.classLoader)
        parcel.recycle()

        assertEquals(3, restored?.size)
        assertEquals(BugReportAttachment.Capture, restored?.get(0))
        assertEquals(
            BugReportAttachment.Screenshot("screenshot.webp", "/tmp/screenshot.webp"),
            restored?.get(1),
        )
        assertEquals(BugReportAttachment.Image(uri), restored?.get(2))
    }
}
