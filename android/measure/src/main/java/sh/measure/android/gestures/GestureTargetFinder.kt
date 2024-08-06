package sh.measure.android.gestures

import android.content.res.Resources
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.node.RootForTest
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.getAllSemanticsNodes
import androidx.compose.ui.semantics.getOrNull
import sh.measure.android.utils.ComposeHelper

internal data class Target(
    val className: String,
    val id: String?,
    val width: Int?,
    val height: Int?,
)

internal object GestureTargetFinder {
    fun findScrollable(view: ViewGroup, event: MotionEvent): Target? {
        val foundView = findScrollableRecursively(view, event.x, event.y) ?: return null

        val target = when {
            ComposeHelper.isComposeView(foundView) -> findComposeTarget(
                foundView,
                event,
                SemanticsActions.ScrollBy,
            )

            else -> foundView.toTarget()
        }
        return target
    }

    fun findClickable(view: ViewGroup, event: MotionEvent): Target? {
        val foundView = findClickableViewRecursively(view, event) ?: return null

        val target = when {
            ComposeHelper.isComposeView(foundView) -> findComposeTarget(
                foundView,
                event,
                SemanticsActions.OnClick,
            )

            else -> foundView.toTarget()
        }
        return target
    }

    private fun findClickableViewRecursively(
        view: ViewGroup,
        motionEvent: MotionEvent,
    ): View? {
        if (ComposeHelper.isComposeView(view)) {
            return view
        }

        for (i in view.childCount - 1 downTo 0) {
            val child = view.getChildAt(i)
            if (hitTest(child, motionEvent.x, motionEvent.y)) {
                if (child.isPressed) {
                    return child
                } else if (child.isClickable) {
                    return child
                } else if (child is ViewGroup) {
                    val result = findClickableViewRecursively(child, motionEvent)
                    if (result != null) {
                        return result
                    }
                }
            }
        }
        return null
    }

    private fun findComposeTarget(
        view: View,
        motionEvent: MotionEvent,
        semanticsPropertyKey: SemanticsPropertyKey<*>,
    ): Target? {
        val semanticsOwner = (view as? RootForTest)?.semanticsOwner ?: return null
        val semanticsNodes = semanticsOwner.getAllSemanticsNodes(true)
        semanticsNodes.forEach {
            val point = Offset(motionEvent.x, motionEvent.y)
            if (it.boundsInWindow.contains(point)) {
                if (it.config.getOrNull(semanticsPropertyKey) != null) {
                    val testTag = it.config.getOrNull(SemanticsProperties.TestTag)
                    return Target(
                        // TODO: implement a way to get the composable name
                        className = view.javaClass.name,
                        id = testTag,
                        width = null,
                        height = null,
                    )
                }
            }
        }
        return null
    }

    private fun findScrollableRecursively(viewGroup: ViewGroup, x: Float, y: Float): View? {
        if (ComposeHelper.isComposeView(viewGroup)) {
            return viewGroup
        }

        var foundView: View? = null
        for (i in viewGroup.childCount - 1 downTo 0) {
            val child = viewGroup.getChildAt(i)
            if (hitTest(child, x, y)) {
                if (child.isScrollContainer && canScroll(child)) {
                    foundView = child
                    break
                } else if (child is ViewGroup) {
                    foundView = findScrollableRecursively(child, x, y)
                    if (foundView != null) {
                        break
                    }
                }
            }
        }
        return foundView
    }

    private fun hitTest(view: View, x: Float, y: Float): Boolean {
        val location = IntArray(2)
        view.getLocationOnScreen(location)
        val left = location[0]
        val top = location[1]
        val right = left + view.width
        val bottom = top + view.height

        return x >= left && x <= right && y >= top && y <= bottom
    }

    private fun canScroll(child: View): Boolean {
        return child.canScrollHorizontally(-1) || child.canScrollHorizontally(1) || child.canScrollVertically(
            -1,
        ) || child.canScrollVertically(1)
    }

    private fun View.toTarget(): Target? {
        val viewId = id
        val target = Target(
            className = javaClass.name,
            id = null,
            width = width,
            height = height,
        )
        if (viewId == View.NO_ID || viewId <= 0 || viewId ushr 24 == 0) {
            return target
        }
        return try {
            val resources = resources ?: return target
            val id = resources.getResourceEntryName(viewId)
            target.copy(id = id)
        } catch (e: Resources.NotFoundException) {
            target
        }
    }
}
