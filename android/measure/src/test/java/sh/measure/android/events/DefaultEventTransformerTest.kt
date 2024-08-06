package sh.measure.android.events

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent

class DefaultEventTransformerTest {
    private val configProvider = FakeConfigProvider()
    private val transformer = DefaultEventTransformer(configProvider)

    @Test
    fun `removes intent data from events if trackActivityIntentData=false`() {
        configProvider.trackActivityIntentData = false

        // lifecycle_activity event
        val lifecycleActivity = TestData.getActivityLifecycleData(intent = "intent-data")
            .toEvent(type = EventType.LIFECYCLE_ACTIVITY)
        assertNull(transformer.transform(lifecycleActivity)!!.data.intent)

        // cold_launch event
        val coldLaunch = TestData.getColdLaunchData(intentData = "intent-data")
            .toEvent(type = EventType.COLD_LAUNCH)
        assertNull(transformer.transform(coldLaunch)!!.data.intent_data)

        // hot_launch event
        val hotLaunch = TestData.getHotLaunchData(intentData = "intent-data")
            .toEvent(type = EventType.HOT_LAUNCH)
        assertNull(transformer.transform(hotLaunch)!!.data.intent_data)

        // warm_launch event
        val warmLaunch = TestData.getWarmLaunchData(intentData = "intent-data")
            .toEvent(type = EventType.WARM_LAUNCH)
        assertNull(transformer.transform(warmLaunch)!!.data.intent_data)
    }

    @Test
    fun `leaves intent data as if trackActivityIntentData=true`() {
        configProvider.trackActivityIntentData = true

        // lifecycle_activity event
        val lifecycleActivity = TestData.getActivityLifecycleData(intent = "intent-data")
            .toEvent(type = EventType.LIFECYCLE_ACTIVITY)
        assertNotNull(transformer.transform(lifecycleActivity)!!.data.intent)

        // cold_launch event
        val coldLaunch = TestData.getColdLaunchData(intentData = "intent-data")
            .toEvent(type = EventType.COLD_LAUNCH)
        assertNotNull(transformer.transform(coldLaunch)!!.data.intent_data)

        // hot_launch event
        val hotLaunch = TestData.getHotLaunchData(intentData = "intent-data")
            .toEvent(type = EventType.HOT_LAUNCH)
        assertNotNull(transformer.transform(hotLaunch)!!.data.intent_data)

        // warm_launch event
        val warmLaunch = TestData.getWarmLaunchData(intentData = "intent-data")
            .toEvent(type = EventType.WARM_LAUNCH)
        assertNotNull(transformer.transform(warmLaunch)!!.data.intent_data)
    }

    @Test
    fun `drops http event if shouldTrackHttpUrl=false`() {
        configProvider.shouldTrackHttpUrl = false

        val httpEvent = TestData.getHttpData().toEvent(type = EventType.HTTP)
        assertNull(transformer.transform(httpEvent))
    }

    @Test
    fun `removes http request and response body if shouldTrackHttpBody=false`() {
        configProvider.shouldTrackHttpUrl = true
        configProvider.shouldTrackHttpBody = false

        val httpEvent = TestData.getHttpData(
            requestBody = "request-body",
            responseBody = "response-body",
        ).toEvent(type = EventType.HTTP)

        assertNull(transformer.transform(httpEvent)!!.data.request_body)
        assertNull(transformer.transform(httpEvent)!!.data.response_body)
    }

    @Test
    fun `keeps http request and response body if shouldTrackHttpBody=true`() {
        configProvider.shouldTrackHttpUrl = true
        configProvider.shouldTrackHttpBody = true

        val httpEvent = TestData.getHttpData(
            requestBody = "request-body",
            responseBody = "response-body",
        ).toEvent(type = EventType.HTTP)

        assertNotNull(transformer.transform(httpEvent)!!.data.request_body)
        assertNotNull(transformer.transform(httpEvent)!!.data.response_body)
    }

    @Test
    fun `removes http headers if trackHttpHeaders=false`() {
        configProvider.shouldTrackHttpUrl = true
        configProvider.trackHttpHeaders = false

        val httpEvent = TestData.getHttpData(
            requestHeaders = mapOf("key1" to "value1"),
            responseHeaders = mapOf("key2" to "value2"),
        ).toEvent(type = EventType.HTTP)

        assertNull(transformer.transform(httpEvent)!!.data.request_headers)
        assertNull(transformer.transform(httpEvent)!!.data.response_headers)
    }

    @Test
    fun `keeps http headers if trackHttpHeaders=true`() {
        configProvider.shouldTrackHttpUrl = true
        configProvider.trackHttpHeaders = true

        val httpEvent = TestData.getHttpData(
            requestHeaders = mapOf("key1" to "value1"),
            responseHeaders = mapOf("key2" to "value2"),
        ).toEvent(type = EventType.HTTP)

        assertNotNull(transformer.transform(httpEvent)!!.data.request_headers)
        assertNotNull(transformer.transform(httpEvent)!!.data.response_headers)
    }

    @Test
    fun `removes http headers part of httpHeadersBlocklist`() {
        configProvider.shouldTrackHttpUrl = true
        configProvider.trackHttpHeaders = true
        configProvider.headerKeysToBlock = listOf("key1")

        val httpEvent = TestData.getHttpData(
            requestHeaders = mapOf("key1" to "value1", "key2" to "value2"),
            responseHeaders = mapOf("key1" to "value1", "key2" to "value2"),
        ).toEvent(type = EventType.HTTP)

        assertNull(transformer.transform(httpEvent)!!.data.request_headers?.get("key1"))
        assertNull(transformer.transform(httpEvent)!!.data.response_headers?.get("key1"))
    }

    @Test
    fun `keeps http headers not part of httpHeadersBlocklist`() {
        configProvider.shouldTrackHttpUrl = true
        configProvider.trackHttpHeaders = true
        configProvider.headerKeysToBlock = listOf("key1")

        val httpEvent = TestData.getHttpData(
            requestHeaders = mapOf("key1" to "value1", "key2" to "value2"),
            responseHeaders = mapOf("key1" to "value1", "key2" to "value2"),
        ).toEvent(type = EventType.HTTP)

        assertNotNull(transformer.transform(httpEvent)!!.data.request_headers?.get("key2"))
        assertNotNull(transformer.transform(httpEvent)!!.data.response_headers?.get("key2"))
    }
}
