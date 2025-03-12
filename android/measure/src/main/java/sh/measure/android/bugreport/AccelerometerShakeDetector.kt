package sh.measure.android.bugreport

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import sh.measure.android.config.ConfigProvider
import sh.measure.android.utils.TimeProvider
import kotlin.math.sqrt

/**
 * Implementation of [ShakeDetector] using accelerometer sensor.
 */
internal class AccelerometerShakeDetector(
    private val sensorManager: SensorManager?,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
) : ShakeDetector, SensorEventListener {

    private val accelerometer: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private var shakeListener: ShakeDetector.Listener? = null
    private var accelerationCurrent = SensorManager.GRAVITY_EARTH
    private var accelerationLast = SensorManager.GRAVITY_EARTH
    private var lastShakeTime: Long = 0
    private var shakeCount: Int = 0
    private var lastNotifyTime: Long = 0
    private val notifyThrottleMs: Long = 5000

    override fun start(): Boolean {
        if (accelerometer == null) {
            return false
        }
        val result = sensorManager?.registerListener(
            this,
            accelerometer,
            SensorManager.SENSOR_DELAY_GAME,
        )
        return result ?: false
    }

    override fun stop() {
        resetState()
        sensorManager?.unregisterListener(this)
    }

    override fun setShakeListener(listener: ShakeDetector.Listener?) {
        this.shakeListener = listener
    }

    override fun getShakeListener(): ShakeDetector.Listener? {
        return shakeListener
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Not used
    }

    override fun onSensorChanged(event: SensorEvent?) {
        event?.takeIf { it.sensor.type == Sensor.TYPE_ACCELEROMETER }?.let {
            processAccelerometerReading(x = it.values[0], y = it.values[1], z = it.values[2])
        }
    }

    private fun processAccelerometerReading(x: Float, y: Float, z: Float) {
        accelerationLast = accelerationCurrent
        accelerationCurrent = calculateMagnitude(x, y, z)
        val delta = accelerationCurrent - accelerationLast
        if (delta > configProvider.shakeAccelerationThreshold) {
            recordMovement()
        }
    }

    /**
     * Calculates the magnitude (length) of the 3D acceleration vector using the Euclidean norm.
     * This applies the Pythagorean theorem in 3D: ||v|| = √(x² + y² + z²)
     * The result represents the total acceleration magnitude independent of direction,
     * which allows for detecting shakes regardless of orientation.
     *
     * @param x The acceleration along the X axis
     * @param y The acceleration along the Y axis
     * @param z The acceleration along the Z axis
     * @return The magnitude of the acceleration vector
     */
    private fun calculateMagnitude(x: Float, y: Float, z: Float): Float {
        return sqrt(x * x + y * y + z * z)
    }

    private fun recordMovement() {
        val currentTime = timeProvider.now()
        if (isTimedOut(currentTime)) {
            shakeCount = 0
        }
        lastShakeTime = currentTime
        shakeCount++
        if (shakeCount >= configProvider.shakeSlop) {
            notifyShake()
            shakeCount = 0
        }
    }

    private fun isTimedOut(currentTime: Long): Boolean {
        return lastShakeTime + configProvider.shakeMinTimeIntervalMs < currentTime
    }

    private fun notifyShake() {
        val currentTime = timeProvider.now()
        if (lastNotifyTime == 0L || currentTime - lastNotifyTime >= notifyThrottleMs) {
            shakeListener?.onShake()
            lastNotifyTime = currentTime
        }
    }

    private fun resetState() {
        shakeCount = 0
        lastShakeTime = 0
        lastNotifyTime = 0
    }
}
