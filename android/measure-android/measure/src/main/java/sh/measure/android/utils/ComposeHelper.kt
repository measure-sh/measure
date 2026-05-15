package sh.measure.android.utils

import android.view.View

internal object ComposeHelper {
    private const val ANDROID_COMPOSE_VIEW_CLASS_NAME =
        "androidx.compose.ui.platform.AndroidComposeView"

    internal fun isComposeView(view: View): Boolean = isComposeAvailable && view.javaClass.name.contains("AndroidComposeView")

    private val isComposeAvailable by lazy(LazyThreadSafetyMode.PUBLICATION) {
        try {
            isClassAvailable(ANDROID_COMPOSE_VIEW_CLASS_NAME)
            true
        } catch (e: Throwable) {
            false
        }
    }
}
