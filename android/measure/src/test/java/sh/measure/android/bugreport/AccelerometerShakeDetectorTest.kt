package sh.measure.android.bugreport

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.SensorEventBuilder
import org.robolectric.shadows.ShadowSensor
import org.robolectric.shadows.ShadowSensorManager
import sh.measure.android.config.ConfigProvider
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import sh.measure.android.utils.TimeProvider
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
class AccelerometerShakeDetectorTest {
    private val context = InstrumentationRegistry.getInstrumentation().context
    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val testSensor: Sensor = ShadowSensor.newInstance(Sensor.TYPE_ACCELEROMETER)
    private val shadowSensorManager: ShadowSensorManager = shadowOf(sensorManager).apply {
        addSensor(testSensor)
    }
    private val testClock = TestClock.create()
    private val timeProvider: TimeProvider = AndroidTimeProvider(testClock)
    private val configProvider: ConfigProvider = FakeConfigProvider()
    private val shakeDetector: AccelerometerShakeDetector =
        AccelerometerShakeDetector(sensorManager, timeProvider, configProvider)
    private val baseTime = 1000L

    @Test
    fun `start registers the sensor`() {
        // When
        val result = shakeDetector.start()

        // Then
        assertTrue(result)
        assertTrue(shadowSensorManager.hasListener(shakeDetector))
    }

    @Test
    fun `stop unregisters the sensor`() {
        // Given
        shakeDetector.start()
        assertTrue(shadowSensorManager.hasListener(shakeDetector))

        // When
        shakeDetector.stop()

        // Then
        assertFalse(shadowSensorManager.hasListener(shakeDetector))
    }

    @Test
    fun `detects shake and notifies via listener`() {
        // Start the detector
        shakeDetector.start()
        var listenerCount = 0
        shakeDetector.setShakeListener(object : ShakeDetector.Listener {
            override fun onShake() {
                listenerCount++
            }
        })

        // Create a sensor event simulator method
        val createValues = { x: Float, y: Float, z: Float ->
            floatArrayOf(x, y, z)
        }

        // Set initial times
        testClock.setTime(baseTime)

        // First shake movement
        fireSensorEvent(createValues(25.0f, 25.0f, 25.0f))

        // Second shake movement
        testClock.advance(Duration.ofMillis(100))
        fireSensorEvent(createValues(45.0f, 45.0f, 45.0f))

        testClock.advance(Duration.ofMillis(100))
        fireSensorEvent(createValues(65.0f, 65.0f, 65.0f))

        // Verify shake was detected
        assertEquals(1, listenerCount)
    }

    @Test
    fun `does not detect shake when time interval exceeded between shakes`() {
        shakeDetector.start()
        var listenerCount = 0
        shakeDetector.setShakeListener(object : ShakeDetector.Listener {
            override fun onShake() {
                listenerCount++
            }
        })
        val createValues = { x: Float, y: Float, z: Float ->
            floatArrayOf(x, y, z)
        }

        // First shake movement
        testClock.setTime(baseTime)
        fireSensorEvent(createValues(5.0f, 5.0f, 5.0f))

        // Second shake movement
        testClock.advance(Duration.ofMillis(100))
        fireSensorEvent(createValues(10.0f, 10.0f, 10.0f))

        // Third shake movement after timeout
        testClock.advance(Duration.ofMillis(100 + configProvider.shakeMinTimeIntervalMs))
        fireSensorEvent(createValues(15.0f, 15.0f, 15.0f))

        assertEquals(0, listenerCount)
    }

    @Test
    fun `does not detect shake when below threshold`() {
        shakeDetector.start()
        var listenerCount = 0
        shakeDetector.setShakeListener(object : ShakeDetector.Listener {
            override fun onShake() {
                listenerCount++
            }
        })
        val createValues = { x: Float, y: Float, z: Float ->
            floatArrayOf(x, y, z)
        }

        // Set time
        testClock.setTime(baseTime)

        // Process events with small changes that won't exceed threshold
        repeat(configProvider.shakeSlop + 1) {
            fireSensorEvent(createValues(0.1f, 0.1f, 0.1f))
        }

        // Verify no shake was detected
        assertEquals(0, listenerCount)
    }

    private fun fireSensorEvent(values: FloatArray) {
        val event = SensorEventBuilder.newBuilder().setSensor(testSensor).setValues(values).build()
        shakeDetector.onSensorChanged(event)
    }
}
