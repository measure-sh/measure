package sh.measure.android.storage

import kotlinx.serialization.json.Json
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.gestures.ClickData
import sh.measure.android.gestures.LongClickData
import sh.measure.android.gestures.ScrollData
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.lifecycle.ActivityLifecycleType
import sh.measure.android.lifecycle.AppLifecycleType
import sh.measure.android.lifecycle.ApplicationLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleType
import sh.measure.android.lifecycle.TestFragment
import sh.measure.android.lifecycle.TestLifecycleActivity
import sh.measure.android.navigation.NavigationData
import sh.measure.android.networkchange.NetworkChangeData
import sh.measure.android.networkchange.NetworkType
import sh.measure.android.okhttp.HttpData
import sh.measure.android.performance.CpuUsageData
import sh.measure.android.performance.LowMemoryData
import sh.measure.android.performance.MemoryUsageData
import sh.measure.android.performance.TrimMemoryData

internal class EventStoreTest {
    private val fileStorage = mock<FileStorage>()
    private val database = mock<Database>()
    private val idProvider = FakeIdProvider()

    private val eventStore: EventStore = EventStoreImpl(
        fileStorage, database, idProvider
    )

    @Test
    fun `stores unhandled exception event in database and the exception data in a file`() {
        val filePath = "file_path"
        val eventId = idProvider.id
        `when`(fileStorage.createExceptionFile(eventId)).thenReturn(filePath)
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()
        val exceptionData = ExceptionFactory.createMeasureException(
            exception,
            handled = true,
            thread = thread,
            foreground = true,
        )

        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = exceptionData,
            type = EventType.EXCEPTION
        )

        // When
        eventStore.storeUnhandledException(event)

        // Then
        verify(fileStorage).createExceptionFile(eventId)
        verify(fileStorage).writeException(filePath, event)
        verify(database).insertEvent(
            EventEntity(
                id = eventId,
                type = EventType.EXCEPTION,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                filePath = filePath
            )
        )
    }

    @Test
    fun `stores ANR event in database and the exception data in a file`() {
        val filePath = "file_path"
        val eventId = idProvider.id
        `when`(fileStorage.createAnrPath(eventId)).thenReturn(filePath)
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()
        val exceptionData = ExceptionFactory.createMeasureException(
            exception,
            handled = true,
            thread = thread,
            foreground = true,
        )

        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = exceptionData,
            type = EventType.ANR
        )

        // When
        eventStore.storeAnr(event)

        // Then
        verify(fileStorage).createAnrPath(eventId)
        verify(fileStorage).writeAnr(filePath, event)
        verify(database).insertEvent(
            EventEntity(
                id = eventId,
                type = EventType.ANR,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                filePath = filePath
            )
        )
    }

    @Test
    fun `serializes and stores click event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = ClickData(
                target = "target",
                target_id = "target_id",
                width = 100,
                height = 200,
                x = 50F,
                y = 50F,
                touch_down_time = 987549876L,
                touch_up_time = 234567609L,
            ),
            type = EventType.CLICK
        )

        // When
        eventStore.storeClick(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.CLICK,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(ClickData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores long click event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = LongClickData(
                target = "target",
                target_id = "target_id",
                width = 100,
                height = 200,
                x = 50F,
                y = 50F,
                touch_down_time = 987549876L,
                touch_up_time = 234567609L,
            ),
            type = EventType.LONG_CLICK
        )

        // When
        eventStore.storeLongClick(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LONG_CLICK,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(LongClickData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores scroll event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = ScrollData(
                target = "target",
                target_id = "target-id",
                x = 50F,
                y = 50F,
                end_x = 100F,
                end_y = 100F,
                direction = "left",
                touch_down_time = 123123213L,
                touch_up_time = 876545678L,
            ),
            type = EventType.SCROLL
        )

        // When
        eventStore.storeScroll(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.SCROLL,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(ScrollData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores activity lifecycle event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.CREATED,
                class_name = TestLifecycleActivity::class.java.name,
                intent = null,
                saved_instance_state = false,
            ),
            type = EventType.LIFECYCLE_ACTIVITY
        )

        // When
        eventStore.storeActivityLifecycle(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LIFECYCLE_ACTIVITY,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(ActivityLifecycleData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores fragment lifecycle event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.ATTACHED,
                parent_activity = TestLifecycleActivity::class.java.name,
                class_name = TestFragment::class.java.name,
            ),
            type = EventType.LIFECYCLE_FRAGMENT
        )

        // When
        eventStore.storeFragmentLifecycle(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LIFECYCLE_FRAGMENT,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(FragmentLifecycleData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores application lifecycle event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = ApplicationLifecycleData(
                type = AppLifecycleType.FOREGROUND,
            ),
            type = EventType.LIFECYCLE_APP
        )

        // When
        eventStore.storeApplicationLifecycle(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LIFECYCLE_APP,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(
                    ApplicationLifecycleData.serializer(),
                    event.data
                )
            )
        )
    }

    @Test
    fun `serializes and stores cold launch event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = ColdLaunchData(
                process_start_uptime = 100,
                process_start_requested_uptime = 200,
                content_provider_attach_uptime = 300,
                on_next_draw_uptime = 400,
                launched_activity = "launched_activity",
                has_saved_state = true,
                intent_data = "intent_data",

                ),
            type = EventType.COLD_LAUNCH
        )

        // When
        eventStore.storeColdLaunch(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.COLD_LAUNCH,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(ColdLaunchData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores warm launch event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = WarmLaunchData(
                app_visible_uptime = 100,
                on_next_draw_uptime = 200,
                launched_activity = "launched_activity",
                has_saved_state = true,
                intent_data = "intent_data",
            ),
            type = EventType.WARM_LAUNCH
        )

        // When
        eventStore.storeWarmLaunch(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.WARM_LAUNCH,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(WarmLaunchData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores hot launch event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = HotLaunchData(
                app_visible_uptime = 100,
                on_next_draw_uptime = 200,
                launched_activity = "launched_activity",
                has_saved_state = true,
                intent_data = "intent_data",
            ),
            type = EventType.HOT_LAUNCH
        )

        // When
        eventStore.storeHotLaunch(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.HOT_LAUNCH,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(HotLaunchData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores network change event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = NetworkChangeData(
                previous_network_type = null,
                network_type = NetworkType.CELLULAR,
                previous_network_generation = null,
                network_generation = null,
                network_provider = "Test Provider",
            ),
            type = EventType.NETWORK_CHANGE
        )

        // When
        eventStore.storeNetworkChange(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.NETWORK_CHANGE,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(NetworkChangeData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores http event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = HttpData(
                url = "url",
                method = "method",
                status_code = 200,
                start_time = 98764567L,
                end_time = 567890987L,
                failure_reason = "failure-reason",
                failure_description = "failure-description",
                request_headers = emptyMap(),
                response_headers = emptyMap(),
                request_body = "request-body",
                response_body = "response-body",
                client = "client",
            ),
            type = EventType.HTTP
        )

        // When
        eventStore.storeHttp(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.HTTP,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(HttpData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores memory usage event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = MemoryUsageData(
                java_max_heap = 100,
                java_total_heap = 200,
                java_free_heap = 300,
                total_pss = 400,
                rss = 500,
                native_total_heap = 600,
                native_free_heap = 700,
                interval_config = 800,
            ),
            type = EventType.MEMORY_USAGE
        )

        // When
        eventStore.storeMemoryUsage(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.MEMORY_USAGE,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(MemoryUsageData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores low memory event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = LowMemoryData(
                java_max_heap = 100,
                java_total_heap = 200,
                java_free_heap = 300,
                total_pss = 400,
                rss = 500,
                native_total_heap = 600,
                native_free_heap = 700,
            ),
            type = EventType.LOW_MEMORY
        )

        // When
        eventStore.storeLowMemory(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.LOW_MEMORY,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(LowMemoryData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores trim memory event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = TrimMemoryData(
                level = "level",
            ),
            type = EventType.TRIM_MEMORY
        )

        // When
        eventStore.storeTrimMemory(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.TRIM_MEMORY,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(TrimMemoryData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores cpu usage event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = CpuUsageData(
                num_cores = 4,
                clock_speed = 10,
                start_time = 123456789L,
                uptime = 987654321L,
                utime = 1234L,
                cutime = 9876L,
                cstime = 1234L,
                stime = 9876L,
                interval_config = 1000,
            ),
            type = EventType.CPU_USAGE
        )

        // When
        eventStore.storeCpuUsage(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.CPU_USAGE,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(CpuUsageData.serializer(), event.data)
            )
        )
    }

    @Test
    fun `serializes and stores navigation event in database`() {
        // Given
        val event = Event(
            timestamp = 1,
            sessionId = "session_id",
            data = NavigationData(
                route = "route",
            ),
            type = EventType.NAVIGATION
        )

        // When
        eventStore.storeNavigation(event)

        // Then
        verify(database).insertEvent(
            EventEntity(
                id = idProvider.id,
                type = EventType.NAVIGATION,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(NavigationData.serializer(), event.data)
            )
        )
    }
}