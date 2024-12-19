package sh.measure.android

import android.Manifest
import androidx.benchmark.junit4.PerfettoTraceRule
import androidx.benchmark.perfetto.ExperimentalPerfettoCaptureApi
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.IdlingRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import okhttp3.Headers
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert
import org.junit.Before
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.config.MeasureConfig
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.lifecycle.ActivityLifecycleType
import sh.measure.android.lifecycle.AppLifecycleType
import java.util.concurrent.TimeUnit

/**
 * Functional tests for the Measure SDK.
 *
 * The tests use the Measure SDK as it would be used in a real app. The only difference is that
 * periodic export is disabled. The tests help verify that the SDK is able to track events
 * and send them to the server.
 *
 * The tests use a MockWebServer to intercept the requests sent by the SDK and verify that the
 * expected events are being sent.
 *
 * These tests also depend on `ANDROIDX_TEST_ORCHESTRATOR`, which is setup in
 * the build.gradle file. Certain tests depend on the application being launched from scratch,
 * which is made possible by adding `testInstrumentationRunnerArguments["clearPackageData"] = "true"`
 *
 * However, the tests do not verify the correctness of the data sent in the events. This can
 * be improved in the future by adding a way to parse the multi-part requests made by the SDK.
 *
 * Also note that certain tests are ignored if the test harness cannot trigger the events
 * in a reliable way, these must be verified manually.
 *
 * See [EventsTestRobot] for helper methods to interact with the test app.
 */
@RunWith(AndroidJUnit4::class)
class EventsTest {
    private val robot: EventsTestRobot = EventsTestRobot()
    private val mockWebServer: MockWebServer = MockWebServer()

    @OptIn(ExperimentalPerfettoCaptureApi::class)
    @get:Rule
    val perfettoRule = PerfettoTraceRule(enableUserspaceTracing = true)

    @Before
    fun setup() {
        mockWebServer.start(port = 8080)
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
    }

    @After
    fun teardown() {
        mockWebServer.shutdown()
    }

    @Test
    fun tracksExceptionEvent() {
        // Given
        robot.disableDefaultExceptionHandler()
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity {
                // When
                robot.crashApp()
            }
            // Then
            assertEventTracked(EventType.EXCEPTION)
        }
    }

    @Test
    fun givenScreenshotOnCrashEnabledThenTracksExceptionEventWithScreenshot() {
        // Given
        robot.disableDefaultExceptionHandler()
        robot.initializeMeasure(MeasureConfig(enableLogging = true, trackScreenshotOnCrash = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity {
                // When
                robot.crashApp()
            }
            val requestBody = getLastRequestBody()

            // Then
            assertEventTracked(requestBody, EventType.EXCEPTION)
            assertScreenshot(requestBody, true)
        }
    }

    @Test
    fun givenScreenshotOnCrashDisabledThenTracksExceptionEventWithoutScreenshot() {
        // Given
        robot.disableDefaultExceptionHandler()
        robot.initializeMeasure(MeasureConfig(enableLogging = true, trackScreenshotOnCrash = false))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity {
                // When
                robot.crashApp()
            }
            val requestBody = getLastRequestBody()

            // Then
            assertEventTracked(requestBody, EventType.EXCEPTION)
            assertScreenshot(requestBody, false)
        }
    }

    @Test
    fun tracksAnrEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            triggerAnr()

            // Then
            assertEventTracked(EventType.ANR)
        }
    }

    @Test
    fun givenScreenshotOnCrashEnabledThenTracksAnrEventWithScreenshot() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true, trackScreenshotOnCrash = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            triggerAnr()
            val requestBody = getLastRequestBody()

            // Then
            assertEventTracked(requestBody, EventType.ANR)
            assertScreenshot(requestBody, true)
        }
    }

    @Test
    fun givenScreenshotOnCrashDisabledThenTracksAnrEventWithoutScreenshot() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true, trackScreenshotOnCrash = false))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            triggerAnr()
            val requestBody = getLastRequestBody()

            // Then
            assertEventTracked(requestBody, EventType.ANR)
            assertScreenshot(requestBody, false)
        }
    }

    @Test
    fun tracksGestureViewClickEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            robot.clickButton()
            triggerExport()

            // Then
            assertEventTracked(EventType.CLICK)
        }
    }

    @Test
    fun tracksGestureComposeClickEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            robot.clickComposeButton()
            triggerExport()
            val requestBody = getLastRequestBody()

            // Then
            assertEventTracked(requestBody, EventType.CLICK)
            // simply checking for click might introduce a false positive
            // so we also check the expected body of the event
            Assert.assertTrue(requestBody.contains("compose_button"))
            Assert.assertTrue(requestBody.contains("androidx.compose.ui.platform.AndroidComposeView"))
        }
    }

    @Test
    fun tracksGestureLongClickEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            robot.longClickButton()
            triggerExport()

            // Then
            assertEventTracked(EventType.LONG_CLICK)
        }
    }

    @Test
    fun tracksGestureScrollEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            robot.scrollDown()
            triggerExport()

            // Then
            assertEventTracked(EventType.SCROLL)
        }
    }

    @Test
    fun tracksGestureComposeScrollEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            robot.composeScrollDown()
            triggerExport()

            // Then
            assertEventTracked(EventType.SCROLL)
        }
    }

    @Test
    fun tracksLifecycleActivityEvents() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            it.moveToState(Lifecycle.State.DESTROYED)
            triggerExport()
            val body = getLastRequestBody()

            // Then
            Assert.assertTrue(body.containsEvent(EventType.LIFECYCLE_ACTIVITY))
            Assert.assertTrue(body.contains(ActivityLifecycleType.CREATED))
            Assert.assertTrue(body.contains(ActivityLifecycleType.RESUMED))
            Assert.assertTrue(body.contains(ActivityLifecycleType.PAUSED))
            Assert.assertTrue(body.contains(ActivityLifecycleType.DESTROYED))
        }
    }

    @Test
    fun tracksLifecycleApplicationEvents() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)

            // When
            robot.pressHomeButton()
            triggerExport()
            val body = getLastRequestBody()

            // Then
            Assert.assertTrue(body.containsEvent(EventType.LIFECYCLE_APP))
            Assert.assertTrue(body.contains(AppLifecycleType.FOREGROUND))
            Assert.assertTrue(body.contains(AppLifecycleType.BACKGROUND))
        }
    }

    @Test
    fun tracksColdLaunchEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            // WHen
            it.moveToState(Lifecycle.State.RESUMED)
            triggerExport()

            // Then
            assertEventTracked(EventType.COLD_LAUNCH)
        }
    }

    @Test
    fun tracksWarmLaunchEvent() {
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.recreate()
            triggerExport()
            assertEventTracked(EventType.WARM_LAUNCH)
        }
    }

    @Test
    @Ignore("Unable to trigger hot launch in tests")
    fun tracksHotLaunchEvent() {
        // Implementation would go here if we could reliably trigger a hot launch in tests
    }

    @Test
    @Ignore("Changing network requires a real internet connection to be available")
    fun tracksNetworkChangeEvent() {
        robot.grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            val networkEnabled = robot.isInternetAvailable()
            robot.enableWiFi(!networkEnabled)
            robot.enableMobileData(!networkEnabled)
            // Network state change takes some time to reflect, so wait for a bit
            // an idle resource would be better.
            Thread.sleep(3000)
            triggerExport()

            // reset network state
            robot.enableWiFi(networkEnabled)
            robot.enableMobileData(networkEnabled)
            assertEventTracked(EventType.NETWORK_CHANGE)
        }
    }

    @Test
    fun givenDefaultConfigThenTracksHttpEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity { activity ->
                IdlingRegistry.getInstance().register(activity.httpIdlingResource)

                // When
                robot.makeNetworkRequest(activity, "http://example:8080")
                activity.httpIdlingResource.registerIdleTransitionCallback {
                    triggerExport()

                    // Then
                    assertEventTracked(EventType.HTTP)
                }
                IdlingRegistry.getInstance().unregister(activity.httpIdlingResource)
            }
        }
    }

    @Test
    fun givenUrlAllowlistContainsUrlThenTracksHttpEvent() {
        // Given
        robot.initializeMeasure(
            MeasureConfig(
                enableLogging = true,
                httpUrlAllowlist = listOf("allowed"),
            ),
        )
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity { activity ->
                IdlingRegistry.getInstance().register(activity.httpIdlingResource)

                // When
                robot.makeNetworkRequest(activity, "http://allowed.com")
                activity.httpIdlingResource.registerIdleTransitionCallback {
                    triggerExport()

                    // Then
                    assertEventTracked(EventType.HTTP)
                }
                IdlingRegistry.getInstance().unregister(activity.httpIdlingResource)
            }
        }
    }

    @Test
    fun givenUrlAllowlistDoesNotContainUrlThenDoesNotTrackHttpEvent() {
        // GIven
        robot.initializeMeasure(
            MeasureConfig(
                enableLogging = true,
                httpUrlAllowlist = listOf("allowed.com"),
            ),
        )
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity { activity ->
                IdlingRegistry.getInstance().register(activity.httpIdlingResource)

                // When
                robot.makeNetworkRequest(activity, "http://notallowed.com")
                activity.httpIdlingResource.registerIdleTransitionCallback {
                    triggerExport()

                    // Then
                    assertEventNotTracked(EventType.HTTP)
                }
                IdlingRegistry.getInstance().unregister(activity.httpIdlingResource)
            }
        }
    }

    @Test
    fun givenUrlBlocklistContainsUrlThenDoesNotTrackHttpEvent() {
        // Given
        robot.initializeMeasure(
            MeasureConfig(
                enableLogging = true,
                httpUrlBlocklist = listOf("disallowed"),
            ),
        )
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity { activity ->
                IdlingRegistry.getInstance().register(activity.httpIdlingResource)

                // When
                robot.makeNetworkRequest(activity, "http://disallowed.com")
                activity.httpIdlingResource.registerIdleTransitionCallback {
                    triggerExport()

                    // Then
                    assertEventNotTracked(EventType.HTTP)
                }
                IdlingRegistry.getInstance().unregister(activity.httpIdlingResource)
            }
        }
    }

    @Test
    fun givenTrackBodyAndTrackHeadersAreEnabledThenTracksHeaders() {
        // Given
        robot.initializeMeasure(
            MeasureConfig(
                enableLogging = true,
                trackHttpBody = true,
                trackHttpHeaders = true,
            ),
        )
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity { activity ->
                IdlingRegistry.getInstance().register(activity.httpIdlingResource)

                // When
                robot.makeNetworkRequest(
                    activity,
                    "http://example.com",
                    headers = Headers.Builder().add("x-header-key", "x-header-value").build(),
                )
                activity.httpIdlingResource.registerIdleTransitionCallback {
                    triggerExport()

                    // Then
                    val body = getLastRequestBody()
                    assertEventTracked(body, EventType.HTTP)
                    Assert.assertTrue(body.contains("x-header-key"))
                    Assert.assertTrue(body.contains("x-header-value"))
                }
                IdlingRegistry.getInstance().unregister(activity.httpIdlingResource)
            }
        }
    }

    @Test
    fun givenTrackHeadersIsDisabledThenDoesNotTrackHeaders() {
        // Given
        robot.initializeMeasure(
            MeasureConfig(
                enableLogging = true,
                trackHttpBody = true,
                trackHttpHeaders = false,
            ),
        )
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity { activity ->
                IdlingRegistry.getInstance().register(activity.httpIdlingResource)

                // When
                robot.makeNetworkRequest(
                    activity,
                    "http://example.com",
                    headers = Headers.Builder().add("x-header-key", "x-header-value").build(),
                )
                activity.httpIdlingResource.registerIdleTransitionCallback {
                    triggerExport()

                    // Then
                    val body = getLastRequestBody()
                    assertEventTracked(body, EventType.HTTP)
                    Assert.assertFalse(body.contains("x-header-key"))
                    Assert.assertFalse(body.contains("x-header-value"))
                }
                IdlingRegistry.getInstance().unregister(activity.httpIdlingResource)
            }
        }
    }

    @Test
    fun givenTrackBodyIsDisabledThenDoesNotTrackBody() {
        // Given
        robot.initializeMeasure(
            MeasureConfig(
                enableLogging = true,
                trackHttpBody = false,
            ),
        )
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity { activity ->
                IdlingRegistry.getInstance().register(activity.httpIdlingResource)

                // When
                robot.makeNetworkRequest(
                    activity,
                    "http://example.com",
                    headers = Headers.Builder().add("x-header-key", "x-header-value").build(),
                    requestBody = "request_body",
                )
                activity.httpIdlingResource.registerIdleTransitionCallback {
                    triggerExport()
                    val body = getLastRequestBody()

                    // Then
                    assertEventTracked(body, EventType.HTTP)
                    Assert.assertFalse(body.contains("request_body"))
                }
                IdlingRegistry.getInstance().unregister(activity.httpIdlingResource)
            }
        }
    }

    @Test
    fun givenTrackBodyIsEnabledThenTracksBody() {
        // Given
        robot.initializeMeasure(
            MeasureConfig(
                enableLogging = true,
                trackHttpBody = true,
            ),
        )
        ActivityScenario.launch(TestActivity::class.java).use {
            it.moveToState(Lifecycle.State.RESUMED)
            it.onActivity { activity ->
                IdlingRegistry.getInstance().register(activity.httpIdlingResource)

                // When
                robot.makeNetworkRequest(
                    activity,
                    "http://example.com",
                    headers = Headers.Builder().add("x-header-key", "x-header-value").build(),
                    requestBody = "request_body",
                )
                activity.httpIdlingResource.registerIdleTransitionCallback {
                    triggerExport()

                    // Then
                    val body = getLastRequestBody()
                    assertEventTracked(body, EventType.HTTP)
                    Assert.assertTrue(body.contains("request_body"))
                }
                IdlingRegistry.getInstance().unregister(activity.httpIdlingResource)
            }
        }
    }

    @Test
    fun tracksMemoryUsageEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            // When
            it.moveToState(Lifecycle.State.RESUMED)
            triggerExport()

            // Then
            assertEventTracked(EventType.MEMORY_USAGE)
        }
    }

    @Test
    fun tracksCpuUsageEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            // When
            it.moveToState(Lifecycle.State.RESUMED)
            triggerExport()

            // Then
            assertEventTracked(EventType.CPU_USAGE)
        }
    }

    @Test
    @Ignore("Unable to trigger trim memory callbacks in tests")
    fun tracksTrimMemoryEvent() {
        // Implementation would go here if we could reliably trigger trim memory in tests
    }

    @Test
    fun tracksCustomEvent() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            // When
            robot.trackCustomEvent()
            triggerExport()

            // Then
            assertEventTracked(EventType.CUSTOM)
        }
    }

    @Test
    fun tracksAttributesWithEvents() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            // When
            robot.addAttribute("user_defined_attr_key", "user_defined_attr_value")
            triggerExport()

            // Then
            assetAttribute("user_defined_attr_key", "user_defined_attr_value")
        }
    }

    private fun String.containsEvent(eventType: String): Boolean {
        return contains("\"type\":\"$eventType\"")
    }

    private fun String.containsAttribute(key: String, value: String): Boolean {
        return contains("\"$key\":\"$value\"")
    }

    private fun triggerExport() {
        Measure.simulateAppCrash(
            type = EventType.EXCEPTION,
            data = ExceptionData(
                exceptions = emptyList(),
                threads = emptyList(),
                handled = false,
                foreground = true,
            ),
            timestamp = 987654321L,
            attributes = mutableMapOf(),
            attachments = mutableListOf(),
        )
    }

    private fun triggerAnr() {
        Measure.simulateAnr(
            data = ExceptionData(
                exceptions = emptyList(),
                threads = emptyList(),
                handled = false,
                foreground = true,
            ),
            timestamp = 987654321L,
            attributes = mutableMapOf(),
            attachments = mutableListOf(),
        )
    }

    private fun assertEventTracked(body: String, eventType: String) {
        Assert.assertTrue(body.containsEvent(eventType))
    }

    private fun assertScreenshot(requestBody: String, expected: Boolean) {
        if (expected) {
            Assert.assertTrue(requestBody.contains("\"type\":\"screenshot\""))
        } else {
            Assert.assertFalse(requestBody.contains("\"type\":\"screenshot\""))
        }
    }

    private fun assertEventTracked(eventType: String) {
        val body = getLastRequestBody()
        Assert.assertTrue(body.containsEvent(eventType))
    }

    private fun assertEventNotTracked(eventType: String) {
        val body = getLastRequestBody()
        Assert.assertFalse(body.containsEvent(eventType))
    }

    private fun assetAttribute(key: String, value: String) {
        val body = getLastRequestBody()
        Assert.assertTrue(body.containsAttribute(key, value))
    }

    private fun getLastRequestBody(): String {
        val request = mockWebServer.takeRequest(timeout = 1000, unit = TimeUnit.MILLISECONDS)
        Assert.assertNotNull(request)
        return request!!.body.readUtf8()
    }
}
