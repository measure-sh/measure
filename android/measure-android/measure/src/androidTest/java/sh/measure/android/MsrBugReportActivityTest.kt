package sh.measure.android

import android.Manifest
import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.bugreport.MsrBugReportActivity
import sh.measure.android.config.MeasureConfig

@RunWith(AndroidJUnit4::class)
class MsrBugReportActivityTest {
    private val robot: MsrBugReportActivityRobot = MsrBugReportActivityRobot()
    private val mockWebServer: MockWebServer = MockWebServer()

    @get:Rule
    val grantPermissionRule: GrantPermissionRule = GrantPermissionRule.grant(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.POST_NOTIFICATIONS,
        Manifest.permission.READ_MEDIA_AUDIO,
        Manifest.permission.READ_EXTERNAL_STORAGE,
    )

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
    fun launchWithInitialScreenshot() {
        // Given
        val initializer = robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use { activity ->
            activity.moveToState(Lifecycle.State.RESUMED)
            activity.onActivity {
                // When
                initializer.bugReportCollector.startBugReportFlow()
            }

            // Then
            robot.assertBugReportActivityLaunched()
            robot.assertTotalScreenshots(1)
            robot.assertSendCtaEnabled(true)
        }
    }

    @Test
    fun launchWithoutInitialScreenshot() {
        // Given
        val initializer = robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use { activity ->
            activity.moveToState(Lifecycle.State.RESUMED)
            activity.onActivity {
                // When
                initializer.bugReportCollector.startBugReportFlow(takeScreenshot = false)
            }

            // Then
            robot.assertBugReportActivityLaunched()
            robot.assertTotalScreenshots(0)
            robot.assertSendCtaEnabled(true)
        }
    }

    @Test
    fun removeScreenshotUpdatesUI() {
        // Given
        val initializer = robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use { activity ->
            activity.moveToState(Lifecycle.State.RESUMED)
            activity.onActivity {
                // When
                initializer.bugReportCollector.startBugReportFlow()
            }
            // Then
            robot.assertBugReportActivityLaunched()
            robot.assertTotalScreenshots(value = 1)
            robot.removeScreenshot(index = 0)
            robot.assertTotalScreenshots(value = 0)
        }
    }

    @Test
    fun clickingCloseExitsTheBugReportActivity() {
        // Given
        val initializer = robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use { activity ->
            activity.moveToState(Lifecycle.State.RESUMED)
            activity.onActivity {
                initializer.bugReportCollector.startBugReportFlow()
            }
            // Then
            robot.assertBugReportActivityLaunched()
            robot.clickCloseButton()
            robot.assertBugReportActivityNotVisible()
        }
    }

    @Test
    fun tracksBugReport() {
        // Given
        val initializer = robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use { activity ->
            activity.moveToState(Lifecycle.State.RESUMED)
            activity.onActivity {
                // When
                val attributes = AttributesBuilder().put("attr_key", "value").build()
                initializer.bugReportCollector.startBugReportFlow(attributes = attributes)
            }
            // Then
            robot.assertBugReportActivityLaunched()
            robot.enterDescription(1)
            robot.clickSendCTA()
            robot.assetBugReportTracked(attachmentCount = 1, userDefinedAttrCount = 1)
        }
    }

    @Test
    fun retainsStateOnConfigurationChange() {
        // Given
        val initializer = robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use { activity ->
            activity.moveToState(Lifecycle.State.RESUMED)
            activity.onActivity {
                // When
                val attributes = AttributesBuilder().put("attr_key", "attr_value").build()
                initializer.bugReportCollector.startBugReportFlow(attributes = attributes)
            }
            // Then
            robot.assertBugReportActivityLaunched()
            robot.enterDescription()
            robot.triggerConfigurationChange()
            robot.clickSendCTA()
            robot.assetBugReportTracked(attachmentCount = 1, userDefinedAttrCount = 1)
        }
    }

    @Test
    fun tracksScreenshotEncodedBeforeTheScreenOpens() {
        // Given
        val initializer = robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use { activity ->
            activity.moveToState(Lifecycle.State.RESUMED)
            val screenIntent = startBugReportFlowWithEncodedScreenshot(initializer, activity)

            // When
            ActivityScenario.launch<MsrBugReportActivity>(screenIntent).use {
                // Then
                robot.assertTotalScreenshots(1)
                robot.clickSendCTA()
                robot.assetBugReportTracked(attachmentCount = 1)
            }
        }
    }

    @Test
    fun keepsOneScreenshotEncodedBeforeTheScreenOpensWhenRecreated() {
        // Given
        val initializer = robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use { activity ->
            activity.moveToState(Lifecycle.State.RESUMED)
            val screenIntent = startBugReportFlowWithEncodedScreenshot(initializer, activity)
            ActivityScenario.launch<MsrBugReportActivity>(screenIntent).use { screen ->
                // When
                screen.recreate()

                // Then
                robot.assertTotalScreenshots(1)
                robot.clickSendCTA()
                robot.assetBugReportTracked(attachmentCount = 1)
            }
        }
    }

    /**
     * Starts the bug report flow but holds back the bug report screen until the screenshot has
     * finished encoding. Returns the intent that opens the screen.
     */
    private fun startBugReportFlowWithEncodedScreenshot(
        initializer: TestMeasureInitializer,
        activity: ActivityScenario<TestActivity>,
    ): Intent {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        var screenIntent: Intent? = null
        val monitor = object : Instrumentation.ActivityMonitor() {
            override fun onStartActivity(intent: Intent): Instrumentation.ActivityResult? {
                if (intent.component?.className != MsrBugReportActivity::class.java.name) {
                    return null
                }
                screenIntent = intent
                return Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null)
            }
        }
        instrumentation.addMonitor(monitor)
        try {
            activity.onActivity { initializer.bugReportCollector.startBugReportFlow() }
            val screenshot = initializer.bugReportCollector.getPendingScreenshot()
            assertNotNull("The screenshot was not captured", screenshot)
            screenshot!!.encoding?.get()
            // Runs the main thread task that marks the screenshot as encoded.
            instrumentation.waitForIdleSync()
            assertNotNull("The screenshot was not encoded", screenshot.encodedAttachment())
        } finally {
            instrumentation.removeMonitor(monitor)
        }
        return requireNotNull(screenIntent) { "The bug report screen was not started" }
    }

    @Test
    @Ignore("Skipped as picking image from gallery is not reliable in tests")
    fun addsImageFromGallery() {
        // Unable to create an image URI which can be read by the app under test
    }
}
