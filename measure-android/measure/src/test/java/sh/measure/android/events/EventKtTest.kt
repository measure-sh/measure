package sh.measure.android.events

import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import okio.Buffer
import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.appexit.AppExit
import sh.measure.android.applaunch.ColdLaunchEvent
import sh.measure.android.applaunch.HotLaunchEvent
import sh.measure.android.applaunch.WarmLaunchEvent
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.Direction
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.navigation.NavigationEvent
import sh.measure.android.networkchange.NetworkChangeEvent
import sh.measure.android.networkchange.NetworkGeneration
import sh.measure.android.networkchange.NetworkType
import sh.measure.android.okhttp.HttpClientName
import sh.measure.android.okhttp.HttpEvent
import sh.measure.android.performance.CpuUsage
import sh.measure.android.performance.LowMemory
import sh.measure.android.performance.MemoryUsage
import sh.measure.android.performance.TrimMemory
import sh.measure.android.utils.iso8601Timestamp

class EventKtTest {
    @Test
    fun `Event serializes to JSON`() {
        val event = Event(
            timestamp = "2021-09-09T09:09:09.009Z",
            type = "test",
            data = Json.encodeToJsonElement(String.serializer(), "data"),
            thread_name = "thread",
        )
        val result = event.toJson()
        assertEquals(
            "{\"timestamp\":\"2021-09-09T09:09:09.009Z\",\"type\":\"test\",\"test\":\"data\",\"thread_name\":\"thread\"}",
            result,
        )
    }

    @Test
    fun `Event writes to sink`() {
        val event = Event(
            timestamp = "2021-09-09T09:09:09.009Z",
            type = "test",
            data = Json.encodeToJsonElement(String.serializer(), "data"),
            thread_name = "thread",
        )

        val buffer = Buffer().apply {
            use {
                event.write(it)
            }
        }

        assertEquals(
            "{\"timestamp\":\"2021-09-09T09:09:09.009Z\",\"type\":\"test\",\"test\":\"data\",\"thread_name\":\"thread\"}",
            buffer.readUtf8(),
        )
    }

    @Test
    fun `MeasureException toEvent() returns an event of type Exception, when exception is not an ANR`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val exception = ExceptionFactory.createMeasureException(
            throwable = Exception("Test exception"),
            handled = false,
            timestamp = timestamp,
            thread = Thread.currentThread(),
            networkType = null,
            networkGeneration = null,
            networkProvider = null,
            deviceLocale = "en-US",
            foreground = true,
            isAnr = false,
        )
        val event = exception.toEvent()

        assertEquals(exception.thread_name, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.EXCEPTION, event.type)
    }

    @Test
    fun `MeasureException toEvent() returns an event of type ANR, when exception is an ANR`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val exception = ExceptionFactory.createMeasureException(
            throwable = Exception("Test exception"),
            handled = false,
            timestamp = timestamp,
            thread = Thread.currentThread(),
            networkType = null,
            networkGeneration = null,
            networkProvider = null,
            deviceLocale = "en-US",
            foreground = true,
            isAnr = true,
        )
        val event = exception.toEvent()

        assertEquals(exception.thread_name, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.ANR, event.type)
    }

    @Test
    fun `Click toEvent() returns an event of type gesture_click`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val click = ClickEvent(
            target = "android.widget.Button",
            target_id = "button",
            width = 100,
            height = 50,
            x = 10f,
            y = 20f,
            touch_down_time = 28071579,
            touch_up_time = 28071632,
            timestamp = 0L,
            thread_name = threadName,
        )

        val event = click.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.CLICK, event.type)
    }

    @Test
    fun `LongClick toEvent() returns an event of type gesture_long_click`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val longClick = LongClickEvent(
            target = "android.widget.Button",
            target_id = "button",
            width = 100,
            height = 50,
            x = 10f,
            y = 20f,
            touch_down_time = 28071579,
            touch_up_time = 28071632,
            timestamp = timestamp,
            thread_name = threadName,
        )

        val event = longClick.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.LONG_CLICK, event.type)
    }

    @Test
    fun `Scroll toEvent() returns an event of type gesture_scroll`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val scroll = ScrollEvent(
            target = "android.widget.ScrollView",
            target_id = "scroll_view",
            x = 10f,
            y = 20f,
            end_x = 30f,
            end_y = 40f,
            direction = Direction.Down.name.lowercase(),
            touch_down_time = 28071579,
            touch_up_time = 28071632,
            timestamp = timestamp,
            thread_name = threadName,
        )

        val event = scroll.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.SCROLL, event.type)
    }

    @Test
    fun `AppExit toEvent() returns an event of type app_exit`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val appExit = AppExit(
            reason = "reason",
            importance = "importance",
            trace = "trace",
            process_name = "process_name",
            pid = "pid",
            timestamp = timestamp,
            thread_name = threadName,
        )
        val event = appExit.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.APP_EXIT, event.type)
    }

    @Test
    fun `ColdLaunch toEvent() returns an event of type cold_launch`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val coldLaunch = ColdLaunchEvent(
            timestamp = timestamp,
            thread_name = threadName,
            process_start_uptime = 0L,
            process_start_requested_uptime = 1L,
            content_provider_attach_uptime = 2L,
            on_next_draw_uptime = 3L,
            launched_activity = "activity_name",
            has_saved_state = false,
            intent_data = "intent",
        )

        val event = coldLaunch.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.COLD_LAUNCH, event.type)
    }

    @Test
    fun `WarmLaunch toEvent() returns an event of type hot_launch`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val hotLaunch = WarmLaunchEvent(
            timestamp = timestamp,
            thread_name = threadName,
            app_visible_uptime = 0L,
            on_next_draw_uptime = 1L,
            launched_activity = "activity_name",
            has_saved_state = false,
            intent_data = "intent",
        )
        val event = hotLaunch.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.WARM_LAUNCH, event.type)
    }

    @Test
    fun `HotLaunch toEvent() returns an event of type hot_launch`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val hotLaunch = HotLaunchEvent(
            timestamp = timestamp,
            thread_name = threadName,
            app_visible_uptime = 0L,
            on_next_draw_uptime = 1L,
            launched_activity = "activity_name",
            has_saved_state = false,
            intent_data = "intent",
        )
        val event = hotLaunch.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.HOT_LAUNCH, event.type)
    }

    @Test
    fun `ConnectivityChange toEvent() returns an event of type network_type_change`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val connectivityChange = NetworkChangeEvent(
            previous_network_type = NetworkType.WIFI,
            network_type = NetworkType.CELLULAR,
            previous_network_generation = null,
            network_generation = NetworkGeneration.FIFTH_GEN,
            network_provider = null,
            timestamp = timestamp,
            thread_name = threadName,
        )
        val event = connectivityChange.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.NETWORK_CHANGE, event.type)
    }

    @Test
    fun `HttpEvent toEvent() returns an event of type http`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val httpEvent = HttpEvent(
            url = "https://www.measure.sh/",
            method = "GET",
            status_code = 200,
            start_time = 0L,
            end_time = 0L,
            failure_reason = null,
            failure_description = null,
            client = HttpClientName.OK_HTTP,
            timestamp = timestamp,
            request_headers = mapOf(),
            response_headers = mapOf(),
            request_body = null,
            response_body = null,
            thread_name = threadName,
        )
        val event = httpEvent.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.HTTP, event.type)
    }

    @Test
    fun `MemoryUsage toEvent() returns an event of type memory_usage`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val memoryUsage = MemoryUsage(
            java_max_heap = 0L,
            java_total_heap = 0L,
            java_free_heap = 0L,
            total_pss = 0,
            rss = 0L,
            native_total_heap = 0L,
            native_free_heap = 0L,
            interval_config = 0L,
            timestamp = timestamp,
            thread_name = threadName,
        )
        val event = memoryUsage.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.MEMORY_USAGE, event.type)
    }

    @Test
    fun `LowMemory toEvent() returns an event of type low_memory`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val lowMemory = LowMemory(
            timestamp = timestamp,
            java_max_heap = 0L,
            java_total_heap = 0L,
            java_free_heap = 0L,
            total_pss = 0,
            rss = 0L,
            native_total_heap = 0L,
            native_free_heap = 0L,
            thread_name = threadName,
        )
        val event = lowMemory.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.LOW_MEMORY, event.type)
    }

    @Test
    fun `TrimMemory toEvent() returns an event of type trim_memory`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val trimMemory = TrimMemory(
            level = "TRIM_MEMORY_UI_HIDDEN",
            timestamp = timestamp,
            thread_name = threadName,
        )
        val event = trimMemory.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.TRIM_MEMORY, event.type)
    }

    @Test
    fun `CPUUsage toEvent() returns an event of type cpu_usage`() {
        val timestamp = 0L
        val timestampIso = timestamp.iso8601Timestamp()
        val threadName = "thread"
        val cpuUsage = CpuUsage(
            num_cores = 0,
            clock_speed = 0,
            uptime = 0,
            utime = 0,
            stime = 0,
            cutime = 0,
            cstime = 0,
            interval_config = 0,
            start_time = 0,
            thread_name = threadName,
            timestamp = timestamp,
        )
        val event = cpuUsage.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestampIso, event.timestamp)
        assertEquals(EventType.CPU_USAGE, event.type)
    }

    @Test
    fun `NavigationEvent toEvent() returns an event of type navigation`() {
        val timestamp = 0L
        val threadName = "thread"
        val navigation = NavigationEvent(
            route = "route",
            thread_name = threadName,
            timestamp = timestamp,
        )
        val event = navigation.toEvent()

        assertEquals(threadName, event.thread_name)
        assertEquals(timestamp.iso8601Timestamp(), event.timestamp)
        assertEquals(EventType.NAVIGATION, event.type)
    }
}
