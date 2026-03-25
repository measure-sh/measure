package sh.measure.android.layoutinspector

import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric.buildActivity
import sh.measure.android.gestures.DetectedGesture

@RunWith(AndroidJUnit4::class)
class LayoutInspectorTest {
    private val controller = buildActivity(LayoutInspectorTestActivity::class.java)

    private fun initActivityWithView(view: View) {
        val activity = controller.get()
        val rootView = FrameLayout(activity)
        rootView.addView(view)
        activity.setContentView(rootView)
        activity.setTitle(null)
        controller.setup()
    }

    private fun findNode(root: LayoutElement?, label: String): LayoutElement? {
        if (root == null) return null
        if (root.label == label) return root
        for (child in root.children) {
            val found = findNode(child, label)
            if (found != null) return found
        }
        return null
    }

    private fun findAllNodes(root: LayoutElement?, label: String): List<LayoutElement> {
        if (root == null) return emptyList()
        val results = mutableListOf<LayoutElement>()
        if (root.label == label) results.add(root)
        for (child in root.children) {
            results.addAll(findAllNodes(child, label))
        }
        return results
    }

    private fun findNodeById(root: LayoutElement?, id: String): LayoutElement? {
        if (root == null) return null
        if (root.id == id) return root
        for (child in root.children) {
            val found = findNodeById(child, id)
            if (found != null) return found
        }
        return null
    }

    private fun findAllByType(root: LayoutElement?, type: ElementType): List<LayoutElement> {
        if (root == null) return emptyList()
        val results = mutableListOf<LayoutElement>()
        if (root.type == type) results.add(root)
        for (child in root.children) {
            results.addAll(findAllByType(child, type))
        }
        return results
    }

    private fun anyHighlighted(root: LayoutElement?): Boolean {
        if (root == null) return false
        if (root.highlighted) return true
        return root.children.any { anyHighlighted(it) }
    }

    // Robolectric returns (0,0) for getLocationInWindow for all views, so we can't
    // test precise hit-testing with real coordinates. Instead, gesture tests use
    // (0f,0f) to guarantee a hit and (99999f,99999f) to guarantee a miss.
    private fun motionEvent(x: Float, y: Float): MotionEvent = MotionEvent.obtain(0L, 0L, MotionEvent.ACTION_DOWN, x, y, 0)

    private fun clickGesture(x: Float = 0f, y: Float = 0f) = DetectedGesture.Click(
        x = x,
        y = y,
        touchDownTime = 0L,
        touchUpTime = 0L,
        timestamp = 0L,
    )

    private fun longClickGesture(x: Float = 0f, y: Float = 0f) = DetectedGesture.LongClick(
        x = x,
        y = y,
        touchDownTime = 0L,
        touchUpTime = 0L,
        timestamp = 0L,
    )

    // --- View: basic capture ---

    @Test
    fun `single TextView is captured with type Text and correct label`() {
        val activity = controller.get()
        val textView = TextView(activity).apply { text = "Hello" }
        initActivityWithView(textView)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val node = findNode(snapshot.root, "TextView")
        assertNotNull(node)
        assertEquals(ElementType.Text, node!!.type)
        assertEquals("TextView", node.label)
    }

    @Test
    fun `nested ViewGroup hierarchy preserves parent-child structure`() {
        val activity = controller.get()
        val parent = LinearLayout(activity)
        val child1 = TextView(activity).apply { text = "A" }
        val child2 = TextView(activity).apply { text = "B" }
        parent.addView(child1)
        parent.addView(child2)
        initActivityWithView(parent)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val linearLayout = findNode(snapshot.root, "LinearLayout")
        assertNotNull(linearLayout)
        val textViews = findAllNodes(linearLayout, "TextView")
        assertEquals(2, textViews.size)
    }

    @Test
    fun `id is resource entry name when view has android id`() {
        val activity = controller.get()
        val textView = TextView(activity).apply {
            id = android.R.id.text1
            text = "Hello"
        }
        initActivityWithView(textView)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val node = findNode(snapshot.root, "TextView")
        assertNotNull(node)
        assertEquals("text1", node!!.id)
    }

    @Test
    fun `clickable TextView has type Container`() {
        val activity = controller.get()
        val textView = TextView(activity).apply {
            text = "Clickable text"
            isClickable = true
        }
        initActivityWithView(textView)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val node = findNode(snapshot.root, "TextView")
        assertNotNull(node)
        assertEquals(ElementType.Container, node!!.type)
    }

    // --- View: visibility filtering ---

    @Test
    fun `invisible views are skipped`() {
        val activity = controller.get()
        val textView = TextView(activity).apply {
            text = "Hidden"
            visibility = View.INVISIBLE
        }
        initActivityWithView(textView)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val node = findNode(snapshot.root, "TextView")
        assertNull(node)
    }

    @Test
    fun `gone views are skipped`() {
        val activity = controller.get()
        val textView = TextView(activity).apply {
            text = "Gone"
            visibility = View.GONE
        }
        initActivityWithView(textView)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val node = findNode(snapshot.root, "TextView")
        assertNull(node)
    }

    // --- View: empty and zero-size ViewGroups ---

    @Test
    fun `empty ViewGroup is skipped`() {
        val activity = controller.get()
        val parent = LinearLayout(activity)
        val emptyGroup = FrameLayout(activity)
        val textView = TextView(activity).apply { text = "Visible" }
        parent.addView(emptyGroup)
        parent.addView(textView)
        initActivityWithView(parent)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        assertNotNull(findNode(snapshot.root, "TextView"))
        val linearLayout = findNode(snapshot.root, "LinearLayout")
        assertNotNull(linearLayout)
        val hasEmptyFrameLayout = linearLayout!!.children.any {
            it.label == "FrameLayout" && it.children.isEmpty()
        }
        assertFalse("Empty FrameLayout should be skipped", hasEmptyFrameLayout)
    }

    @Test
    fun `zero-width ViewGroup is skipped`() {
        val activity = controller.get()
        val zeroWidthGroup = FrameLayout(activity).apply {
            layoutParams = FrameLayout.LayoutParams(0, 100)
        }
        val textView = TextView(activity).apply { text = "Inside" }
        zeroWidthGroup.addView(textView)
        initActivityWithView(zeroWidthGroup)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val node = findNode(snapshot.root, "Inside")
        assertNull(node)
    }

    // --- View: gesture highlighting ---

    @Test
    fun `clickable view at touch point is highlighted`() {
        val activity = controller.get()
        val button = Button(activity).apply { text = "Click me" }
        initActivityWithView(button)

        val gesture = clickGesture(0f, 0f)
        val event = motionEvent(0f, 0f)
        val snapshot = LayoutInspector.capture(
            activity.window.decorView.rootView,
            gesture,
            event,
        )
        val node = findNode(snapshot.root, "Button")
        assertNotNull(node)
        assertTrue(node!!.highlighted)
        event.recycle()
    }

    @Test
    fun `clickable view with touch miss is not highlighted`() {
        val activity = controller.get()
        val button = Button(activity).apply { text = "Click me" }
        initActivityWithView(button)

        val gesture = clickGesture(99999f, 99999f)
        val event = motionEvent(99999f, 99999f)
        val snapshot = LayoutInspector.capture(
            activity.window.decorView.rootView,
            gesture,
            event,
        )
        val node = findNode(snapshot.root, "Button")
        assertNotNull(node)
        assertFalse(node!!.highlighted)
        event.recycle()
    }

    @Test
    fun `long-clickable view is highlighted`() {
        val activity = controller.get()
        val textView = TextView(activity).apply {
            text = "Long press me"
            isLongClickable = true
        }
        initActivityWithView(textView)

        val gesture = longClickGesture(0f, 0f)
        val event = motionEvent(0f, 0f)
        val snapshot = LayoutInspector.capture(
            activity.window.decorView.rootView,
            gesture,
            event,
        )
        val node = findNode(snapshot.root, "TextView")
        assertNotNull(node)
        assertTrue(node!!.highlighted)
        event.recycle()
    }

    @Test
    fun `capture without gesture produces no highlighted nodes`() {
        val activity = controller.get()
        val button = Button(activity).apply { text = "Click me" }
        initActivityWithView(button)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        assertFalse("No nodes should be highlighted", anyHighlighted(snapshot.root))
    }

    // --- Compose: basic capture ---

    @Test
    fun `compose Text is captured with type Text`() {
        val activity = controller.get()
        val composeView = ComposeView(activity)
        composeView.setContent {
            Text(text = "Hello Compose")
        }
        initActivityWithView(composeView)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val composeRoot = findNode(snapshot.root, "AndroidComposeView")
        assertNotNull("AndroidComposeView should be in the tree", composeRoot)
        val textNodes = findAllByType(composeRoot, ElementType.Text)
        assertTrue("Should have at least one Text element", textNodes.isNotEmpty())
    }

    @Test
    fun `compose testTag is used as id and label`() {
        val activity = controller.get()
        val composeView = ComposeView(activity)
        composeView.setContent {
            Box(modifier = Modifier.size(100.dp).testTag("my_box"))
        }
        initActivityWithView(composeView)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val node = findNodeById(snapshot.root, "my_box")
        assertNotNull("Node with testTag 'my_box' should exist", node)
        assertEquals("my_box", node!!.id)
        assertEquals("my_box", node.label)
    }

    @Test
    fun `compose nested hierarchy preserves parent-child structure`() {
        val activity = controller.get()
        val composeView = ComposeView(activity)
        composeView.setContent {
            Column(modifier = Modifier.testTag("column")) {
                Text(text = "Child 1")
                Text(text = "Child 2")
            }
        }
        initActivityWithView(composeView)

        val snapshot = LayoutInspector.capture(activity.window.decorView.rootView)
        val column = findNodeById(snapshot.root, "column")
        assertNotNull("Column with testTag should be found", column)
        val textChildren = findAllByType(column, ElementType.Text)
        assertEquals(2, textChildren.size)
    }

    // --- Compose: gesture highlighting ---

    @Test
    fun `compose clickable element is highlighted for click gesture`() {
        val activity = controller.get()
        val composeView = ComposeView(activity)
        composeView.setContent {
            Box(modifier = Modifier.size(200.dp).testTag("clickable_box").clickable { })
        }
        initActivityWithView(composeView)

        val gesture = clickGesture(0f, 0f)
        val event = motionEvent(0f, 0f)
        val snapshot = LayoutInspector.capture(
            activity.window.decorView.rootView,
            gesture,
            event,
        )
        val node = findNodeById(snapshot.root, "clickable_box")
        assertNotNull(node)
        assertTrue("Clickable compose node should be highlighted", node!!.highlighted)
        event.recycle()
    }

    @Test
    fun `compose non-clickable element is not highlighted for click gesture`() {
        val activity = controller.get()
        val composeView = ComposeView(activity)
        composeView.setContent {
            Box(modifier = Modifier.size(200.dp).testTag("plain_box"))
        }
        initActivityWithView(composeView)

        val gesture = clickGesture(0f, 0f)
        val event = motionEvent(0f, 0f)
        val snapshot = LayoutInspector.capture(
            activity.window.decorView.rootView,
            gesture,
            event,
        )
        val node = findNodeById(snapshot.root, "plain_box")
        assertNotNull(node)
        assertFalse("Non-clickable compose node should not be highlighted", node!!.highlighted)
        event.recycle()
    }
}
