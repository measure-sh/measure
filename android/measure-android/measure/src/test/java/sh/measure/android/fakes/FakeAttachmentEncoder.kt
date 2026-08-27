package sh.measure.android.fakes

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import sh.measure.android.bugreport.AttachmentEncoder
import sh.measure.android.bugreport.EncodedScreenshot
import sh.measure.android.events.AttachmentType
import sh.measure.android.events.Attachment as EventAttachment

internal class FakeAttachmentEncoder : AttachmentEncoder {
    var captured: Bitmap? = Bitmap.createBitmap(4, 8, Bitmap.Config.ARGB_8888)
    var preview: Bitmap? = Bitmap.createBitmap(2, 4, Bitmap.Config.ARGB_8888)
    var encoded: EncodedScreenshot? = null
    val deletedPaths: MutableList<String> = mutableListOf()

    override fun capture(activity: Activity): Bitmap? = captured

    override fun scalePreview(bitmap: Bitmap): Bitmap? = preview

    override fun encodeScreenshot(bitmap: Bitmap): EncodedScreenshot? = encoded

    override fun encodeImage(context: Context, uri: Uri): EventAttachment? = EventAttachment(
        name = "screenshot.webp",
        type = AttachmentType.SCREENSHOT,
        bytes = byteArrayOf(4, 5, 6),
    )

    override fun deleteScreenshot(path: String) {
        deletedPaths.add(path)
    }
}
