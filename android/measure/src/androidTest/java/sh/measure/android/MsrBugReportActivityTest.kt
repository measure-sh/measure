package sh.measure.android

import android.Manifest
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.GrantPermissionRule
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.attributes.AttributesBuilder
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
    @Ignore("Skipped as picking image from gallery is not reliable in tests")
    fun addsImageFromGallery() {
        // Unable to create an image URI which can be read by the app under test
    }
}
