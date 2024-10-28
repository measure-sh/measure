package sh.measure.android

import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.config.MeasureConfig

@RunWith(AndroidJUnit4::class)
class SessionTest {
    private val robot: SessionTestRobot = SessionTestRobot()
    private val mockWebServer: MockWebServer = MockWebServer()

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
    fun createsNewSessionOnInitialization() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            // When
            it.moveToState(Lifecycle.State.RESUMED)

            // Then
            val sessionCount = robot.getSessionCount()
            Assert.assertEquals(1, sessionCount)
        }
    }

    @Test
    fun createsNewSessionWhenAppComesBackToForegroundAfterThresholdTimeElapsed() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            // When
            it.moveToState(Lifecycle.State.RESUMED)
            robot.moveAppToBackground()
            robot.incrementTimeBeyondLastEventThreshold()
            robot.openAppFromRecent()
            it.moveToState(Lifecycle.State.RESUMED)

            // Then
            val sessionCount = robot.getSessionCount()
            Assert.assertEquals(2, sessionCount)
        }
    }

    @Test
    fun continuesSessionWhenAppComesBackToForegroundBeforeThresholdTimeElapsed() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            // When
            it.moveToState(Lifecycle.State.RESUMED)
            robot.moveAppToBackground()
            robot.incrementTimeWithinSessionThreshold()
            robot.openAppFromRecent()
            it.moveToState(Lifecycle.State.RESUMED)

            // Then
            val sessionCount = robot.getSessionCount()
            Assert.assertEquals(1, sessionCount)
        }
    }

    @Test
    fun createsNewSessionWhenAppComesBackToForegroundIfLastSessionCrashed() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        ActivityScenario.launch(TestActivity::class.java).use {
            // When
            it.moveToState(Lifecycle.State.RESUMED)
            robot.simulateAppCrash()
            robot.moveAppToBackground()
            robot.incrementTimeWithinSessionThreshold()
            robot.openAppFromRecent()
            it.moveToState(Lifecycle.State.RESUMED)

            // Then
            val sessionCount = robot.getSessionCount()
            Assert.assertEquals(2, sessionCount)
        }
    }

    @Test
    fun createsNewSessionOnInitializationWhenMaxSessionDurationForPreviousSessionHasBeenReached() {
        // Given
        robot.initializeMeasure(MeasureConfig(enableLogging = true))
        robot.setSessionMaxDurationConfig(5000L)
        robot.setSessionEndThresholdConfig(10000L)
        ActivityScenario.launch(TestActivity::class.java).use {
            // When
            it.moveToState(Lifecycle.State.RESUMED)
            robot.moveAppToBackground()
            robot.incrementTimeBeyondMaxSessionDuration()
            robot.openAppFromRecent()
            it.moveToState(Lifecycle.State.RESUMED)

            // Then
            val sessionCount = robot.getSessionCount()
            Assert.assertEquals(2, sessionCount)
        }
    }
}
