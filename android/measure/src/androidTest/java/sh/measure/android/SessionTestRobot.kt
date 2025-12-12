package sh.measure.android

import android.app.Application
import android.view.KeyEvent
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Assert.fail
import sh.measure.android.config.MeasureConfig
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.AndroidLogger
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.storage.SessionsTable
import sh.measure.android.utils.AndroidTimeProvider

class SessionTestRobot {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.context.applicationContext
    private val logger = AndroidLogger(enabled = true)
    private val database = DatabaseImpl(context, logger)
    private val device = UiDevice.getInstance(instrumentation)
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val configProvider = FakeConfigProvider()

    fun initializeMeasure(config: MeasureConfig = MeasureConfig()) {
        Measure.initForInstrumentationTest(
            TestMeasureInitializer(
                application = context as Application,
                timeProvider = timeProvider,
                logger = logger,
                database = database,
                configProvider = configProvider,
                inputConfig = config,
            ),
        )
    }

    fun getSessionCount(): Int {
        val countSessionsQuery = """
                SELECT ${SessionsTable.COL_SESSION_ID}
                FROM ${SessionsTable.TABLE_NAME}
        """.trimIndent()
        database.readableDatabase.rawQuery(countSessionsQuery, null).use {
            return it.count
        }
    }

    fun incrementTimeBeyondLastEventThreshold() {
        testClock.advance(configProvider.sessionBackgroundTimeoutThresholdMs + 1000)
    }

    fun incrementTimeWithinSessionThreshold() {
        testClock.advance(configProvider.sessionBackgroundTimeoutThresholdMs - 1000)
    }

    fun moveAppToBackground() {
        testClock.advance(1000)
        device.pressHome()
        device.waitForIdle()
    }

    fun openAppFromRecent() {
        device.pressKeyCode(KeyEvent.KEYCODE_APP_SWITCH)
        device.pressKeyCode(KeyEvent.KEYCODE_APP_SWITCH)
        device.waitForIdle()
        val textObject = device.wait(Until.findObject(By.textStartsWith("sh.measure.android")), 5000)
        if (textObject != null) {
            textObject.click()
        } else {
            fail("Unable to bring app back from recent apps")
        }
    }

    fun simulateAppCrash() {
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
}
