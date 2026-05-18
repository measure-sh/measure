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
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.TestClock
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
    private val configProvider: ConfigProvider = FakeConfigProvider()
    private val shakeDetector: AccelerometerShakeDetector =
        AccelerometerShakeDetector(sensorManager, configProvider, NoopLogger())
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
        shakeDetector.start()
        var shakeCount = 0
        shakeDetector.setShakeListener(object : ShakeDetector.Listener {
            override fun onShake() {
                shakeCount++
            }
        })

        // Use values that exceed the threshold (29.43)
        // Magnitude = sqrt(18² + 18² + 18²) = 31.18, which is > 29.43
        val shakeValues = floatArrayOf(18.0f, 18.0f, 18.0f)

        // Generate many significant movements (only need 2 now)
        repeat(configProvider.shakeSlop * 10) {
            fireSensorEvent(shakeValues)
            testClock.advance(Duration.ofMillis(50))
        }

        // assert the callback is called just once
        assertEquals(1, shakeCount)
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

        testClock.setTime(baseTime)
        val strongShake = floatArrayOf(18.0f, 18.0f, 18.0f) // Above threshold (31.18 > 29.43)

        // Generate 1 movement, then wait too long before the 2nd
        fireSensorEvent(strongShake)

        // Advance beyond the 5-second time window so movements expire
        testClock.advance(Duration.ofSeconds(6))
        fireSensorEvent(strongShake)

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

        testClock.setTime(baseTime)

        // Use values below threshold (29.43)
        // Magnitude = sqrt(10² + 10² + 10²) = 17.32, which is below the threshold
        val weakShake = floatArrayOf(10.0f, 10.0f, 10.0f)

        // Generate many events, but all below threshold
        repeat(configProvider.shakeSlop * 2) {
            fireSensorEvent(weakShake)
            testClock.advance(Duration.ofMillis(50))
        }

        assertEquals(0, listenerCount)
    }

    private fun fireSensorEvent(values: FloatArray) {
        val timestampNanos = testClock.epochTime() * 1_000_000L // Convert millis to nanos
        val event = SensorEventBuilder.newBuilder()
            .setSensor(testSensor)
            .setValues(values)
            .setTimestamp(timestampNanos)
            .build()
        shakeDetector.onSensorChanged(event)
    }
}
