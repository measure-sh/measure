package sh.measure.android.utils

import android.app.Activity
import android.os.Looper
import org.robolectric.Shadows
import org.robolectric.android.controller.ActivityController

/**
 * Forces the activity to draw a frame by dispatching a draw pass on the decor view.
 */
fun <T : Activity> ActivityController<T>.forceDrawFrame() {
    val decorView = get().window.decorView
    decorView.viewTreeObserver.dispatchOnDraw()
    Shadows.shadowOf(Looper.getMainLooper()).idle()
}
