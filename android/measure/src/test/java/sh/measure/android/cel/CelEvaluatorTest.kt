package sh.measure.android.cel

import junit.framework.TestCase.assertFalse
import junit.framework.TestCase.assertTrue
import org.junit.Test
import sh.measure.android.attributes.StringAttr
import sh.measure.android.events.EventType
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent
import sh.measure.android.lifecycle.ActivityLifecycleType
import sh.measure.android.lifecycle.AppLifecycleType
import sh.measure.android.lifecycle.FragmentLifecycleType

class CelEvaluatorTest {
    private val evaluator = CelEvaluator()

    @Test
    fun `evaluate boolean true literal returns true`() {
        val expression = "true"
        val dummyEvent = TestData.getClickData().toEvent(type = EventType.CLICK)
        val result = evaluator.evaluate(expression, dummyEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate boolean false literal returns false`() {
        val expression = "false"
        val dummyEvent = TestData.getClickData().toEvent(type = EventType.CLICK)
        val result = evaluator.evaluate(expression, dummyEvent)

        assertFalse(result)
    }

    @Test
    fun `evaluate with string literal expression coerces to true`() {
        val expression = "\"hello\""
        val dummyEvent = TestData.getClickData().toEvent(type = EventType.CLICK)
        val result = evaluator.evaluate(expression, dummyEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate with empty string literal expression coerces to false`() {
        val expression = "\"\""
        val dummyEvent = TestData.getClickData().toEvent(type = EventType.CLICK)
        val result = evaluator.evaluate(expression, dummyEvent)

        assertFalse(result)
    }

    @Test
    fun `evaluate with numeric literal expression coerces to true`() {
        val expression = "42"
        val dummyEvent = TestData.getClickData().toEvent(type = EventType.CLICK)
        val result = evaluator.evaluate(expression, dummyEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate with null literal expression coerces to false`() {
        val expression = "null"
        val dummyEvent = TestData.getClickData().toEvent(type = EventType.CLICK)
        val result = evaluator.evaluate(expression, dummyEvent)

        assertFalse(result)
    }

    @Test
    fun `evaluate event type`() {
        val expression = """
            type == "gesture_click"
           """.trimIndent()
        val clickEvent = TestData.getClickData().toEvent(type = EventType.CLICK)
        val result = evaluator.evaluate(expression, clickEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate attribute`() {
        val expression = """
            attribute.some_key == "some_value"
           """.trimIndent()
        val clickEvent = TestData.getClickData()
            .toEvent(type = EventType.CLICK, attributes = mutableMapOf("some_key" to "some_value"))
        val result = evaluator.evaluate(expression, clickEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate user defined attribute`() {
        val expression = """
            user_defined_attribute.some_key == "some_value"
           """.trimIndent()
        val clickEvent = TestData.getClickData()
            .toEvent(
                type = EventType.CLICK, userDefinedAttributes = mutableMapOf(
                    "some_key" to StringAttr("some_value")
                )
            )
        val result = evaluator.evaluate(expression, clickEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate session ID`() {
        val expression = """
            session_id == "some_session_id"
           """.trimIndent()
        val clickEvent = TestData.getClickData()
            .toEvent(type = EventType.CLICK, sessionId = "some_session_id")
        val result = evaluator.evaluate(expression, clickEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate gesture_click property access`() {
        val expression = """
            gesture_click.target == "target_view"
            && gesture_click.target_id == "target_id" 
            && gesture_click.width == 100
            && gesture_click.height == 200
            && gesture_click.x == 300
            && gesture_click.y == 400
            && gesture_click.touch_down_time == 123 
            && gesture_click.touch_up_time == 456
           """.trimIndent()
        val clickEvent = TestData.getClickData(
            target = "target_view",
            targetId = "target_id",
            width = 100,
            height = 200,
            x = 300F,
            y = 400F,
            touchDownTime = 123L,
            touchUpTime = 456L,
        ).toEvent(type = EventType.CLICK)
        val result = evaluator.evaluate(expression, clickEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate gesture_long_click property access`() {
        val expression = """
            gesture_long_click.target == "target_view"
            && gesture_long_click.target_id == "target_id" 
            && gesture_long_click.width == 100
            && gesture_long_click.height == 200
            && gesture_long_click.x == 300
            && gesture_long_click.y == 400
            && gesture_long_click.touch_down_time == 123 
            && gesture_long_click.touch_up_time == 456
           """.trimIndent()
        val clickEvent = TestData.getLongClickData(
            target = "target_view",
            targetId = "target_id",
            width = 100,
            height = 200,
            x = 300F,
            y = 400F,
            touchDownTime = 123L,
            touchUpTime = 456L,
        ).toEvent(type = EventType.LONG_CLICK)
        val result = evaluator.evaluate(expression, clickEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate gesture_scroll property access`() {
        val expression = """
            gesture_scroll.target == "target_view"
            && gesture_scroll.target_id == "target_id" 
            && gesture_scroll.x == 300
            && gesture_scroll.y == 400
            && gesture_scroll.end_x == 500
            && gesture_scroll.end_y == 600
            && gesture_scroll.direction == "left"
            && gesture_scroll.touch_down_time == 123
            && gesture_scroll.touch_up_time == 456
           """.trimIndent()
        val scrollEvent = TestData.getScrollData(
            target = "target_view",
            targetId = "target_id",
            x = 300F,
            y = 400F,
            touchDownTime = 123L,
            touchUpTime = 456L,
            endX = 500F,
            endY = 600F,
        ).toEvent(type = EventType.SCROLL)
        val result = evaluator.evaluate(expression, scrollEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate lifecycle_app property access`() {
        val expression = """
            lifecycle_app.type == "foreground"
           """.trimIndent()
        val appEvent = TestData.getApplicationLifecycleData(
            type = AppLifecycleType.FOREGROUND
        ).toEvent(type = EventType.LIFECYCLE_APP)
        val result = evaluator.evaluate(expression, appEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate lifecycle_activity property access`() {
        val expression = """
            lifecycle_activity.type == "created"
            && lifecycle_activity.class_name == "MainActivity"
            && lifecycle_activity.intent == null
            && lifecycle_activity.saved_instance_state == true
           """.trimIndent()
        val activityEvent = TestData.getActivityLifecycleData(
            type = ActivityLifecycleType.CREATED,
            className = "MainActivity",
            intent = null,
            savedInstanceState = true
        ).toEvent(type = EventType.LIFECYCLE_ACTIVITY)
        val result = evaluator.evaluate(expression, activityEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate lifecycle_fragment property access`() {
        val expression = """
            lifecycle_fragment.type == "resumed"
            && lifecycle_fragment.class_name == "MainFragment"
            && lifecycle_fragment.intent == null
            && lifecycle_fragment.saved_instance_state == false
           """.trimIndent()
        val activityEvent = TestData.getActivityLifecycleData(
            type = FragmentLifecycleType.RESUMED,
            className = "MainFragment",
            intent = null,
            savedInstanceState = false
        ).toEvent(type = EventType.LIFECYCLE_ACTIVITY)
        val result = evaluator.evaluate(expression, activityEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate cold_launch property access`() {
        val expression = """
            cold_launch.process_start_uptime == 10
            && cold_launch.launched_activity.contains("MainActivity")
            && cold_launch.has_saved_state == false
            && cold_launch.intent_data == null
            && cold_launch.content_provider_attach_uptime == 50
            && cold_launch.process_start_requested_uptime == 70
            && cold_launch.on_next_draw_uptime == 60
        """.trimIndent()
        val coldLaunchEvent = TestData.getColdLaunchData(
            processStartUptime = 10,
            contentProviderAttachUptime = 50,
            launchedActivity = "sh.measure.MainActivity",
            intentData = null,
            hasSavedState = false,
            onNextDrawUptime = 60,
            processStartRequestedUptime = 70
        )
        val result =
            evaluator.evaluate(expression, coldLaunchEvent.toEvent(type = EventType.COLD_LAUNCH))
        assertTrue(result)
    }

    @Test
    fun `evaluate warm_launch property access`() {
        val expression = """
            warm_launch.process_start_uptime == 10
            && warm_launch.app_visible_uptime == 20
            && warm_launch.launched_activity == "sh.measure.MainActivity"
            && warm_launch.has_saved_state == false
            && warm_launch.intent_data == null
            && warm_launch.is_lukewarm == true
            && warm_launch.content_provider_attach_uptime == 50
            && warm_launch.process_start_requested_uptime == 60
            && warm_launch.on_next_draw_uptime == 30
            """
        val warmLaunchEvent = TestData.getWarmLaunchData(
            processStartUptime = 10,
            appVisibleUptime = 20,
            launchedActivity = "sh.measure.MainActivity",
            intentData = null,
            isLukewarm = true,
            hasSavedState = false,
            onNextDrawUptime = 30,
            contentProviderAttachUptime = 50,
            processStartRequestedUptime = 60
        ).toEvent(type = EventType.WARM_LAUNCH)
        val result = evaluator.evaluate(expression, warmLaunchEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate http property access`() {
        val expression = """
            http.url.contains("api.measure.sh/users")
            && http.method == "get"
            && http.end_time == 456
            && http.start_time == 123
            && http.status_code == 200
            && http.client == "okhttp"
        """.trimIndent()
        val httpEvent = TestData.getHttpData(
            url = "https://api.measure.sh/users",
            method = "get",
            endTime = 456L,
            startTime = 123L,
            statusCode = 200,
            client = "okhttp"
        )
        val result = evaluator.evaluate(expression, httpEvent.toEvent(type = EventType.HTTP))

        assertTrue(result)
    }

    @Test
    fun `evaluate network_change property access`() {
        val expression = """
            network_change.network_type == "wifi"
            && network_change.network_provider == "airtel"
            && network_change.network_generation == "unknown"
            && network_change.previous_network_type == "cellular"
            && network_change.previous_network_generation == "4G"
        """
        val networkChangeEvent =
            TestData.getNetworkChangeData(
                networkType = "wifi",
                networkProvider = "airtel",
                networkGeneration = "unknown",
                previousNetworkType = "cellular",
                previousNetworkGeneration = "4G"
            ).toEvent(type = EventType.NETWORK_CHANGE)
        val result = evaluator.evaluate(expression, networkChangeEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate cpu_usage property access`() {
        val expression = """
            cpu_usage.percentage_usage == 10.0
            && cpu_usage.stime == 456
            && cpu_usage.utime == 789
            && cpu_usage.cstime == 563
            && cpu_usage.cutime == 657
            && cpu_usage.uptime == 193
            && cpu_usage.interval == 10
            && cpu_usage.num_cores == 1
            && cpu_usage.clock_speed == 30
            """
        val cpuUsageEvent = TestData.getCpuUsageData(
            startTime = 123,
            percentageUsage = 10.0,
            stime = 456,
            utime = 789,
            cstime = 563,
            cutime = 657,
            uptime = 193,
            interval = 10,
            numCores = 1,
            clockSpeed = 30
        ).toEvent(type = EventType.CPU_USAGE)
        val result = evaluator.evaluate(expression, cpuUsageEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate exception property access`() {
        val expression = """
            exception.handled == true
            && exception.foreground == false
        """
        val exceptionEvent = TestData.getExceptionData(
            exception = IllegalArgumentException("Test exception"),
            foreground = false,
            handled = true
        ).toEvent(type = EventType.EXCEPTION)
        val result = evaluator.evaluate(expression, exceptionEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate memory_usage property access`() {
        val expression = """
            memory_usage.total_pss == 100
            && memory_usage.rss == 200
            && memory_usage.java_max_heap == 300
            && memory_usage.java_free_heap == 400
            && memory_usage.java_total_heap == 500
            && memory_usage.native_free_heap == 600
            && memory_usage.native_total_heap == 700
            && memory_usage.interval == 10
        """.trimIndent()
        val memoryUsageEvent = TestData.getMemoryUsageData(
            interval = 10,
            totalPss = 100,
            rss = 200,
            javaMaxHeap = 300,
            javaFreeHeap = 400,
            javaTotalHeap = 500,
            nativeFreeHeap = 600,
            nativeTotalHeap = 700,
        ).toEvent(type = EventType.MEMORY_USAGE)
        val result = evaluator.evaluate(expression, memoryUsageEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate screen_view property access`() {
        val expression = """
            screen_view.name == "screen-name"
        """.trimIndent()
        val screenViewEvent = TestData.getScreenViewData().toEvent(type = EventType.SCREEN_VIEW)
        val result = evaluator.evaluate(expression, screenViewEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate custom property access`() {
        val expression = """
            custom.name == "event-name"
        """.trimIndent()
        val customEvent = TestData.getCustomEvent(
            name = "event-name"
        ).toEvent(type = EventType.CUSTOM)
        val result = evaluator.evaluate(expression, customEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate bug_report property access`() {
        val expression = """
            bug_report.description == "bug-report-desc"
        """
        val bugReportEvent = TestData.getBugReportData(
            description = "bug-report-desc"
        ).toEvent(type = EventType.BUG_REPORT)
        val result = evaluator.evaluate(expression, bugReportEvent)

        assertTrue(result)
    }

    @Test
    fun `evaluate field access on chained null property returns false`() {
        val eventWithNull = TestData.getClickData().toEvent(
            type = EventType.CLICK,
            attributes = mutableMapOf("user" to null)
        )
        val expression = """attributes.user.name == "admin""""
        val result = evaluator.evaluate(expression, eventWithNull)

        assertFalse(result)
    }

    @Test
    fun `evaluate field access on non existent property returns false`() {
        val event = TestData.getClickData().toEvent(type = EventType.CLICK)
        val expression = """data.url == "http://example.com""""
        val result = evaluator.evaluate(expression, event)

        assertFalse(result)
    }

    @Test
    fun `evaluate complex expression with mixed operators evaluates correctly`() {
        val eventData = TestData.getHttpData(statusCode = 200, method = "post")
        val event = eventData.toEvent(
            type = EventType.HTTP,
            attributes = mutableMapOf("source" to "mobile-app")
        )
        val expression =
            """(http.status_code == 200 && attributes.source == "mobile-app") || http.method == "post""""
        val result = evaluator.evaluate(expression, event)
        assertTrue(result)
    }
}