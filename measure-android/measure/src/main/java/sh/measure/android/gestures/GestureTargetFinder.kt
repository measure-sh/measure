package sh.measure.android.gestures

import android.content.res.Resources
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup

internal data class Target(
    val className: String, val id: String?, val width: Int?, val height: Int?
)

internal object GestureTargetFinder {
    fun findScrollable(view: ViewGroup, event: MotionEvent): Target? {
        return findScrollableRecursively(view, event.x, event.y)?.toTarget()
    }

    fun findClickable(view: ViewGroup, event: MotionEvent): Target? {
        return findClickableRecursively(view, event.x, event.y)?.toTarget()
    }

    private fun findScrollableRecursively(viewGroup: ViewGroup, x: Float, y: Float): View? {
        var foundView: View? = null
        for (i in viewGroup.childCount - 1 downTo 0) {
            val child = viewGroup.getChildAt(i)
            if (isViewContainsPoint(child, x, y)) {
                if (isScrollContainer(child) && canScroll(child)) {
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

    private fun findClickableRecursively(viewGroup: ViewGroup, x: Float, y: Float): View? {
        var foundView: View? = null

        for (i in viewGroup.childCount - 1 downTo 0) {
            val child = viewGroup.getChildAt(i)
            if (isViewContainsPoint(child, x, y)) {
                if (isViewPressed(child)) {
                    foundView = child
                    break
                } else if (isViewClickable(child)) {
                    foundView = child
                    break
                } else if (child is ViewGroup) {
                    foundView = findClickableRecursively(child, x, y)
                    if (foundView != null) {
                        break
                    }
                }
            }
        }
        return foundView
    }

    private fun canScroll(child: View): Boolean {
        return child.canScrollHorizontally(-1) || child.canScrollHorizontally(1) || child.canScrollVertically(
            -1
        ) || child.canScrollVertically(1)
    }

    private fun isViewContainsPoint(view: View, x: Float, y: Float): Boolean {
        val location = IntArray(2)
        view.getLocationOnScreen(location)
        val left = location[0]
        val top = location[1]
        val right = left + view.width
        val bottom = top + view.height

        return x >= left && x <= right && y >= top && y <= bottom
    }

    private fun isViewClickable(view: View) = view.isClickable
    private fun isViewPressed(view: View) = view.isPressed
    private fun isScrollContainer(view: View) = view.isScrollContainer

    private fun View.toTarget(): Target? {
        val viewId = id
        val target = Target(
            className = javaClass.name,
            id = null,
            width = width,
            height = height
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