package sh.measure.android.events

import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import okio.Buffer
import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.Direction
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.utils.iso8601Timestamp

class EventKtTest {
    @Test
    fun `Event serializes to JSON`() {
        val event = Event(
            timestamp = "2021-09-09T09:09:09.009Z",
            type = "test",
            data = Json.encodeToJsonElement(String.serializer(), "data")
        )
        val result = event.toJson()
        assertEquals(
            "{\"timestamp\":\"2021-09-09T09:09:09.009Z\",\"type\":\"test\",\"test\":\"data\"}",
            result
        )
    }

    @Test
    fun `Event writes to sink`() {
        val event = Event(
            timestamp = "2021-09-09T09:09:09.009Z",
            type = "test",
            data = Json.encodeToJsonElement(String.serializer(), "data")
        )

        val buffer = Buffer().apply {
            use {
                event.write(it)
            }
        }

        assertEquals(
            "{\"timestamp\":\"2021-09-09T09:09:09.009Z\",\"type\":\"test\",\"test\":\"data\"}",
            buffer.readUtf8()
        )
    }

    @Test
    fun `MeasureException toEvent() returns an event of type Exception, when exception is not an ANR`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val event = ExceptionFactory.createMeasureException(
            throwable = Exception("Test exception"),
            handled = false,
            timestamp = timestamp,
            thread = Thread.currentThread(),
            isAnr = false
        ).toEvent()

        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.EXCEPTION, event.type)
    }

    @Test
    fun `MeasureException toEvent() returns an event of type ANR, when exception is an ANR`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val event = ExceptionFactory.createMeasureException(
            throwable = Exception("Test exception"),
            handled = false,
            timestamp = timestamp,
            thread = Thread.currentThread(),
            isAnr = true
        ).toEvent()

        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.ANR, event.type)
    }

    @Test
    fun `Click toEvent() returns an event of type gesture_click`() {
        val touchUpTime = "1970-01-01T13:25:25.631000000Z"
        val click = ClickEvent(
            target = "android.widget.Button",
            target_id = "button",
            width = 100,
            height = 50,
            x = 10f,
            y = 20f,
            touch_down_time = "1970-01-01T13:25:22.631000000Z",
            touch_up_time = touchUpTime
        )

        val event = click.toEvent()

        assertEquals(touchUpTime, event.timestamp)
        assertEquals(EventType.CLICK, event.type)
    }

    @Test
    fun `LongClick toEvent() returns an event of type gesture_long_click`() {
        val touchUpTime = "1970-01-01T13:25:25.631000000Z"
        val longClick = LongClickEvent(
            target = "android.widget.Button",
            target_id = "button",
            width = 100,
            height = 50,
            x = 10f,
            y = 20f,
            touch_down_time = "1970-01-01T13:25:22.631000000Z",
            touch_up_time = touchUpTime
        )

        val event = longClick.toEvent()

        assertEquals(touchUpTime, event.timestamp)
        assertEquals(EventType.LONG_CLICK, event.type)
    }

    @Test
    fun `Scroll toEvent() returns an event of type gesture_scroll`() {
        val touchUpTime = "1970-01-01T13:25:25.631000000Z"
        val scroll = ScrollEvent(
            target = "android.widget.ScrollView",
            target_id = "scroll_view",
            x = 10f,
            y = 20f,
            end_x = 30f,
            end_y = 40f,
            direction = Direction.Down.name.lowercase(),
            touch_down_time = "1970-01-01T13:25:22.631000000Z",
            touch_up_time = touchUpTime
        )

        val event = scroll.toEvent()

        assertEquals(touchUpTime, event.timestamp)
        assertEquals(EventType.SCROLL, event.type)
    }
}