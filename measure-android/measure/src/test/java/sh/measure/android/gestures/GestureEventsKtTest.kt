package sh.measure.android.gestures

import org.junit.Assert
import org.junit.Test
import sh.measure.android.utils.iso8601Timestamp

class ClickEventTest {

    @Test
    fun `maps DetectedGesture to Click`() {
        val detectedGesture = DetectedGesture.Click(
            x = 10f, y = 20f, touchDownTime = 0L, touchUpTime = 0L
        )
        val target = Target(
            className = "android.widget.Button", id = "button", width = 100f, height = 50f
        )
        val result = ClickEvent.fromDetectedGesture(
            gesture = detectedGesture, target = target
        )
        Assert.assertEquals(target.className, result.target)
        Assert.assertEquals(target.id, result.target_id)
        Assert.assertEquals(target.width, result.width)
        Assert.assertEquals(target.height, result.height)
        Assert.assertEquals(detectedGesture.x, result.x)
        Assert.assertEquals(detectedGesture.y, result.y)
        Assert.assertEquals(
            detectedGesture.touchDownTime.iso8601Timestamp(), result.touch_down_time
        )
        Assert.assertEquals(detectedGesture.touchUpTime.iso8601Timestamp(), result.touch_up_time)
    }
}

internal class LongClickEventTest {
    @Test
    fun `maps DetectedGesture to LongClick`() {
        val detectedGesture = DetectedGesture.LongClick(
            x = 10f, y = 20f, touchDownTime = 0L, touchUpTime = 0L
        )
        val target = Target(
            className = "android.widget.Button", id = "button", width = 100f, height = 50f
        )
        val result = LongClickEvent.fromDetectedGesture(
            gesture = detectedGesture, target = target
        )
        Assert.assertEquals(target.className, result.target)
        Assert.assertEquals(target.id, result.target_id)
        Assert.assertEquals(target.width, result.width)
        Assert.assertEquals(target.height, result.height)
        Assert.assertEquals(detectedGesture.x, result.x)
        Assert.assertEquals(detectedGesture.y, result.y)
        Assert.assertEquals(
            detectedGesture.touchDownTime.iso8601Timestamp(), result.touch_down_time
        )
        Assert.assertEquals(detectedGesture.touchUpTime.iso8601Timestamp(), result.touch_up_time)
    }
}

internal class ScrollEventTest {
    @Test
    fun `maps DetectedGesture to Scroll`() {
        val detectedGesture = DetectedGesture.Scroll(
            startX = 10f,
            startY = 20f,
            endX = 30f,
            endY = 40f,
            touchDownTime = 0L,
            touchUpTime = 0L,
            direction = Direction.Up
        )
        val target = Target(
            className = "android.widget.ScrollView", id = "scroll_view", width = 100f, height = 50f
        )
        val result = ScrollEvent.fromDetectedGesture(
            gesture = detectedGesture, target = target
        )
        Assert.assertEquals(target.className, result.target)
        Assert.assertEquals(target.id, result.target_id)
        Assert.assertEquals(detectedGesture.startX, result.start_x)
        Assert.assertEquals(detectedGesture.startY, result.start_y)
        Assert.assertEquals(detectedGesture.endX, result.end_x)
        Assert.assertEquals(detectedGesture.endY, result.end_y)
        Assert.assertEquals(detectedGesture.direction.name.lowercase(), result.direction)
        Assert.assertEquals(
            detectedGesture.touchDownTime.iso8601Timestamp(), result.touch_down_time
        )
        Assert.assertEquals(detectedGesture.touchUpTime.iso8601Timestamp(), result.touch_up_time)
    }
}