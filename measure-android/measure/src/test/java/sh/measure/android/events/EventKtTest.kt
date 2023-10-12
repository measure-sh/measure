package sh.measure.android.events

import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import okio.Buffer
import org.junit.Assert
import org.junit.Test
import sh.measure.android.exceptions.ExceptionFactory

class EventKtTest {
    @Test
    fun `Event serializes to JSON`() {
        val event = Event(
            timestamp = "2021-09-09T09:09:09.009Z",
            type = "test",
            data = Json.encodeToJsonElement(String.serializer(), "data")
        )
        val result = event.toJson()
        Assert.assertEquals(
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

        Assert.assertEquals(
            "{\"timestamp\":\"2021-09-09T09:09:09.009Z\",\"type\":\"test\",\"test\":\"data\"}",
            buffer.readUtf8()
        )
    }

    @Test
    fun `MeasureException toEvent() returns an event of type Exception, when exception is not an ANR`() {
        val event = ExceptionFactory.createMeasureException(
            throwable = Exception("Test exception"),
            handled = false,
            timestamp = 0L,
            thread = Thread.currentThread(),
            isAnr = false
        ).toEvent()

        assert(event.type == EventType.EXCEPTION)
    }

    @Test
    fun `MeasureException toEvent() returns an event of type ANR, when exception is an ANR`() {
        val event = ExceptionFactory.createMeasureException(
            throwable = Exception("Test exception"),
            handled = false,
            timestamp = 0L,
            thread = Thread.currentThread(),
            isAnr = true
        ).toEvent()

        assert(event.type == EventType.ANR)
    }
}