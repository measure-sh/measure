package sh.measure.android.gestures

import org.junit.Assert
import org.junit.Test

class ClickDataTest {

    @Test
    fun `maps DetectedGesture to Click`() {
        val detectedGesture = DetectedGesture.Click(
            x = 10f,
            y = 20f,
            touchDownTime = 0L,
            touchUpTime = 0L,
            timestamp = 0L,
        )
        val target = Target(
            className = "android.widget.Button",
            id = "button",
            width = 100,
            height = 50,
        )
        val result = ClickData.fromDetectedGesture(
            gesture = detectedGesture,
            target = target,
        )
        Assert.assertEquals(target.className, result.target)
        Assert.assertEquals(target.id, result.target_id)
        Assert.assertEquals(target.width, result.width)
        Assert.assertEquals(target.height, result.height)
        Assert.assertEquals(detectedGesture.x, result.x)
        Assert.assertEquals(detectedGesture.y, result.y)
        Assert.assertEquals(detectedGesture.touchDownTime, result.touch_down_time)
        Assert.assertEquals(detectedGesture.touchUpTime, result.touch_up_time)
    }
}

internal class LongClickDataTest {
    @Test
    fun `maps DetectedGesture to LongClick`() {
        val detectedGesture = DetectedGesture.LongClick(
            x = 10f,
            y = 20f,
            touchDownTime = 0L,
            touchUpTime = 0L,
            timestamp = 0L,
        )
        val target = Target(
            className = "android.widget.Button",
            id = "button",
            width = 100,
            height = 50,
        )
        val result = LongClickData.fromDetectedGesture(
            gesture = detectedGesture,
            target = target,
        )
        Assert.assertEquals(target.className, result.target)
        Assert.assertEquals(target.id, result.target_id)
        Assert.assertEquals(target.width, result.width)
        Assert.assertEquals(target.height, result.height)
        Assert.assertEquals(detectedGesture.x, result.x)
        Assert.assertEquals(detectedGesture.y, result.y)
        Assert.assertEquals(detectedGesture.touchDownTime, result.touch_down_time)
        Assert.assertEquals(detectedGesture.touchUpTime, result.touch_up_time)
    }
}

internal class ScrollDataTest {
    @Test
    fun `maps DetectedGesture to Scroll`() {
        val detectedGesture = DetectedGesture.Scroll(
            x = 10f,
            y = 20f,
            endX = 30f,
            endY = 40f,
            touchDownTime = 0L,
            touchUpTime = 0L,
            direction = Direction.Up,
            timestamp = 0L,
        )
        val target = Target(
            className = "android.widget.ScrollView",
            id = "scroll_view",
            width = 100,
            height = 50,
        )
        val result = ScrollData.fromDetectedGesture(
            gesture = detectedGesture,
            target = target,
        )
        Assert.assertEquals(target.className, result.target)
        Assert.assertEquals(target.id, result.target_id)
        Assert.assertEquals(detectedGesture.x, result.x)
        Assert.assertEquals(detectedGesture.y, result.y)
        Assert.assertEquals(detectedGesture.endX, result.end_x)
        Assert.assertEquals(detectedGesture.endY, result.end_y)
        Assert.assertEquals(detectedGesture.direction.name.lowercase(), result.direction)
        Assert.assertEquals(detectedGesture.touchUpTime, result.touch_up_time)
    }
}
