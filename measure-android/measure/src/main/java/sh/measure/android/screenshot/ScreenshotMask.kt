package sh.measure.android.screenshot

import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.VideoView
import androidx.compose.ui.node.RootForTest
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getAllSemanticsNodes
import androidx.compose.ui.semantics.getOrNull
import androidx.core.view.isVisible
import sh.measure.android.Config
import sh.measure.android.utils.ComposeHelper
import sh.measure.android.utils.isSensitiveInputType

internal class ScreenshotMask(private val config: Config) {

    fun findRectsToMask(view: View): List<Rect> {
        val rects = mutableListOf<Rect>()
        recursivelyFindRectsToMask(view, rects)
        return rects
    }

    private fun recursivelyFindRectsToMask(view: View, rectsToMask: MutableList<Rect>) {
        if (!view.isVisible) {
            return
        }
        when {
            view is ImageView || view is VideoView || isExoplayerView(view) -> {
                if (config.screenshotMaskLevel == ScreenshotMaskLevel.AllTextAndMedia) {
                    val rect = Rect()
                    if (view.getGlobalVisibleRect(rect)) {
                        rectsToMask.add(rect)
                    }
                }
            }

            view is TextView -> {
                if (shouldMaskTextView(view)) {
                    val rect = Rect()
                    if (view.getGlobalVisibleRect(rect)) {
                        rectsToMask.add(rect)
                    }
                }
            }

            ComposeHelper.isComposeView(view) -> {
                findComposableRectsToMask(view, rectsToMask)
            }

            view is ViewGroup -> {
                (0 until view.childCount).forEach {
                    recursivelyFindRectsToMask(view.getChildAt(it), rectsToMask)
                }
            }
        }
    }

    private fun findComposableRectsToMask(view: View, rectsToMask: MutableList<Rect>) {
        val semanticsOwner = (view as? RootForTest)?.semanticsOwner ?: return
        val semanticsNodes = semanticsOwner.getAllSemanticsNodes(true)

        semanticsNodes.forEach { node ->
            val hasEditableText = node.config.getOrNull(SemanticsProperties.EditableText) != null
            val isPassword = node.config.getOrNull(SemanticsProperties.Password) != null
            val hasText = node.config.getOrNull(SemanticsProperties.Text) != null
            val isClickable = isNodeClickable(node)
            val isImage = isNodeImage(node)

            if (isImage && config.screenshotMaskLevel == ScreenshotMaskLevel.AllTextAndMedia) {
                rectsToMask.add(node.boundsInWindow.toRect())
            }

            if (((hasText || hasEditableText)) && shouldMaskComposeText(isClickable, isPassword)) {
                rectsToMask.add(node.boundsInWindow.toRect())
            }
        }
    }

    private fun shouldMaskTextView(view: TextView): Boolean {
        return config.screenshotMaskLevel == ScreenshotMaskLevel.AllTextAndMedia || config.screenshotMaskLevel == ScreenshotMaskLevel.AllText || (config.screenshotMaskLevel == ScreenshotMaskLevel.AllTextExceptClickable && !view.isClickable) || (config.screenshotMaskLevel == ScreenshotMaskLevel.SensitiveFieldsOnly && view.isSensitiveInputType())
    }

    private fun shouldMaskComposeText(isClickable: Boolean, isPassword: Boolean): Boolean {
        return (config.screenshotMaskLevel == ScreenshotMaskLevel.AllTextAndMedia
                || config.screenshotMaskLevel == ScreenshotMaskLevel.AllText
                || (config.screenshotMaskLevel == ScreenshotMaskLevel.AllTextExceptClickable && !isClickable)
                || (config.screenshotMaskLevel == ScreenshotMaskLevel.SensitiveFieldsOnly && isPassword))
    }

    private fun isNodeImage(node: SemanticsNode): Boolean {
        return node.config.getOrNull(SemanticsProperties.ContentDescription) != null
    }

    private fun isNodeClickable(node: SemanticsNode): Boolean {
        return node.config.getOrNull(SemanticsActions.OnClick) != null || node.config.getOrNull(
            SemanticsActions.OnLongClick,
        ) != null
    }

    private fun isExoplayerView(view: View): Boolean {
        return view.javaClass.name.equals("androidx.media3.ui.PlayerView")
    }

    private fun androidx.compose.ui.geometry.Rect.toRect(): Rect {
        return Rect(left.toInt(), top.toInt(), right.toInt(), bottom.toInt())
    }
}