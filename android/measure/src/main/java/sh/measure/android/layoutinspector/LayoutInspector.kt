package sh.measure.android.layoutinspector

import android.content.res.Resources.NotFoundException
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.node.RootForTest
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getAllSemanticsNodes
import androidx.compose.ui.semantics.getOrNull
import sh.measure.android.gestures.DetectedGesture
import sh.measure.android.utils.ComposeHelper

/**
 * Inspects Android View hierarchies to create a snapshot of their current state.
 *
 * The inspector traverses through both traditional Android Views and Jetpack Compose hierarchies,
 * capturing information about each visible element's:
 * - Position and dimensions
 * - Class name and resource ID
 * - Whether the element will consume the gesture
 */
internal object LayoutInspector {
    /**
     * Creates a snapshot of the view hierarchy with information about which element will consume
     * the gesture by performing a hit test.
     *
     * @param rootView The root view to start traversing from.
     * @param gesture The gesture being performed (e.g., click, long press, scroll)
     * @param motionEvent The motion event containing the gesture's coordinates
     * @return A [LayoutSnapshot] containing information about all visible views and compose elements,
     *         including which element would consume the gesture
     */
    fun capture(
        rootView: View,
        gesture: DetectedGesture,
        motionEvent: MotionEvent,
    ): LayoutSnapshot {
        return parseLayoutInternal(rootView, gesture, motionEvent)
    }

    private fun parseLayoutInternal(
        rootView: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): LayoutSnapshot {
        val nodes = mutableListOf<Node>()

        fun traverseView(view: View) {
            if (view.visibility != View.VISIBLE) {
                return
            }
            if (ComposeHelper.isComposeView(view)) {
                val composeNodes = parseComposeView(view, gesture, motionEvent)
                nodes.addAll(composeNodes)
            } else if (view is ViewGroup) {
                if (view.childCount > 0 && view.width > 0 && view.height > 0) {
                    val node = createViewNode(view, gesture, motionEvent)
                    nodes.add(node)
                    for (i in 0 until view.childCount) {
                        traverseView(view.getChildAt(i))
                    }
                }
            } else {
                val node = createViewNode(view, gesture, motionEvent)
                if (node.width > 0 && node.height > 0) {
                    nodes.add(node)
                }
            }
        }
        traverseView(rootView)
        return LayoutSnapshot(nodes)
    }

    private fun createViewNode(
        view: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): Node {
        val location = IntArray(2)
        view.getLocationInWindow(location)

        val willConsumeGesture = willConsumeGesture(view, gesture, motionEvent)

        return Node(
            id = view.getResName(),
            className = view.javaClass.name,
            x = location[0],
            y = location[1],
            width = view.width,
            height = view.height,
            willConsumeGesture = willConsumeGesture,
            gesture = if (willConsumeGesture) gesture else null,
            isText = view is TextView && !view.isClickable,
        )
    }

    private fun willConsumeGesture(
        view: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): Boolean {
        if (gesture == null || motionEvent == null) {
            return false
        }

        val location = IntArray(2)
        view.getLocationInWindow(location)
        return when {
            gesture is DetectedGesture.Click && view.isClickable -> {
                view.hitTest(motionEvent.x, motionEvent.y, location)
            }

            gesture is DetectedGesture.LongClick && view.isLongClickable || view.isPressed -> {
                view.hitTest(motionEvent.x, motionEvent.y, location)
            }

            gesture is DetectedGesture.Scroll && canScroll(view) -> {
                view.hitTest(motionEvent.x, motionEvent.y, location)
            }

            else -> {
                false
            }
        }
    }

    private fun canScroll(view: View): Boolean {
        return if (view.isScrollContainer) {
            view.canScrollHorizontally(-1) || view.canScrollHorizontally(1) || view.canScrollVertically(
                -1,
            ) || view.canScrollVertically(1)
        } else {
            false
        }
    }

    /**
     * Parses a Compose view hierarchy to extract semantic node information.
     *
     * @param view The root view containing Compose elements
     * @param gesture Optional detected gesture (click, long press, scroll)
     * @param motionEvent Optional motion event associated with the gesture
     * @return List of [Node]s representing visible semantic elements with their:
     *         - Position (x,y) and dimensions (width,height) in window coordinates
     *         - Test tag ID and class name
     *         - Gesture consumption status
     */
    @OptIn(ExperimentalComposeUiApi::class)
    private fun parseComposeView(
        view: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): List<Node> {
        val nodes = mutableListOf<Node>()
        val semanticsOwner = (view as? RootForTest)?.semanticsOwner ?: return nodes
        val semanticsNodes = semanticsOwner.getAllSemanticsNodes(true)
        val viewLocation = IntArray(2)
        view.getLocationInWindow(viewLocation)

        for (semanticsNode in semanticsNodes) {
            val isInvisibleToUser =
                semanticsNode.config.getOrNull(SemanticsProperties.InvisibleToUser) != null
            val isText = semanticsNode.config.getOrNull(SemanticsProperties.Text) != null
            if (!isInvisibleToUser) {
                val testTag = semanticsNode.config.getOrNull(SemanticsProperties.TestTag)

                val willConsumeGesture = if (gesture != null && motionEvent != null) {
                    val point = Offset(motionEvent.x, motionEvent.y)
                    if (semanticsNode.boundsInWindow.contains(point)) {
                        val key = when (gesture) {
                            is DetectedGesture.Click -> SemanticsActions.OnClick
                            is DetectedGesture.LongClick -> SemanticsActions.OnLongClick
                            is DetectedGesture.Scroll -> SemanticsActions.ScrollBy
                        }
                        semanticsNode.config.getOrNull(key) != null
                    } else {
                        false
                    }
                } else {
                    false
                }

                val node = Node(
                    id = testTag,
                    className = view.javaClass.name,
                    x = (viewLocation[0] + semanticsNode.boundsInWindow.left).toInt(),
                    y = (viewLocation[1] + semanticsNode.boundsInWindow.top).toInt(),
                    width = semanticsNode.boundsInWindow.width.toInt(),
                    height = semanticsNode.boundsInWindow.height.toInt(),
                    willConsumeGesture = willConsumeGesture,
                    gesture = if (willConsumeGesture) gesture else null,
                    isText = isText,
                )
                if (node.width > 0 && node.height > 0) {
                    nodes.add(node)
                }
            }
        }
        return nodes
    }

    private fun View.hitTest(x: Float, y: Float, location: IntArray): Boolean {
        val left = location[0]
        val top = location[1]
        val right = left + width
        val bottom = top + height
        return x >= left && x <= right && y >= top && y <= bottom
    }

    private fun View.getResName(): String? {
        if (id != View.NO_ID && resources != null) {
            try {
                val resourceName = resources.getResourceEntryName(id)
                return resourceName
            } catch (_: NotFoundException) {
                // Ignore
            }
        }
        return null
    }
}
