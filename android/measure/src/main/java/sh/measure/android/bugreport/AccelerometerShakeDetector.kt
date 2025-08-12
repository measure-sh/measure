package sh.measure.android.bugreport

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import sh.measure.android.config.ConfigProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.util.concurrent.TimeUnit
import kotlin.math.pow

/**
 * Detects shake gestures using the device accelerometer.
 *
 * Algorithm Overview:
 * The shake detector works by monitoring accelerometer readings and identifying rapid,
 * significant movements that collectively indicate a shake gesture. It uses a sliding
 * window approach to capture the burst of movements typical in a shake.
 *
 * Detailed Process:
 * 1. **Magnitude Calculation**: For each accelerometer reading (x,y,z), calculates the
 *    total acceleration magnitude using: sqrt(x² + y² + z²). Uses squared values for
 *    performance, avoiding the expensive sqrt operation.
 *
 * 2. **Threshold Filtering**: Only movements exceeding the configured acceleration
 *    threshold (default 2.5 * GRAVITY_EARTH ≈ 24.5 m/s²) are considered "significant".
 *    This filters out minor movements like walking or gentle handling.
 *
 * 3. **Sliding Window**: Maintains a 1.5-second sliding window of significant movement
 *    timestamps. Older movements are automatically removed as time progresses.
 *
 * 4. **Shake Detection**: A shake is detected when the number of significant movements
 *    in the window reaches the configured "slop" count (default 2). This ensures
 *    multiple rapid movements are required, not just a single jolt.
 *
 * 5. **Cooldown Prevention**: After detecting a shake, enters a cooldown period
 *    (default 5s) to prevent multiple notifications for the same physical shake.
 *    This handles the fact that a single shake generates many sensor readings.
 *
 * Configuration:
 * - shakeAccelerationThreshold: Minimum acceleration to count as significant (default: 2.5 * GRAVITY_EARTH)
 * - shakeSlop: Number of significant movements required for shake detection (default: 2)
 * - shakeMinTimeIntervalMs: Cooldown period between shake notifications (default: 5000ms)
 */
internal class AccelerometerShakeDetector(
    private val sensorManager: SensorManager?,
    private val configProvider: ConfigProvider,
    private val logger: Logger,
) : ShakeDetector, SensorEventListener {

    private val accelerometer: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private var shakeListener: ShakeDetector.Listener? = null

    // Queue of timestamps when significant movements occurred
    private val significantMovementsQueue = ArrayDeque<Long>()
    private var lastShakeTime: Long = 0

    // 1.5-second sliding window for movement detection
    private val timeWindowNs = TimeUnit.MILLISECONDS.toNanos(1500)

    // Pre-squared threshold for performance (avoids sqrt in comparison)
    private val squaredShakeAccelerationThreshold = configProvider.shakeAccelerationThreshold.pow(2)

    // Cooldown to prevent multiple detections for single shake
    private val detectionCooldownNs =
        TimeUnit.MILLISECONDS.toNanos(configProvider.shakeMinTimeIntervalMs)

    override fun start(): Boolean {
        if (sensorManager == null) {
            logger.log(LogLevel.Error, "SensorManager unavailable, shake detection will not work")
            return false
        }
        if (accelerometer == null) {
            logger.log(
                LogLevel.Error,
                "Accelerometer sensor unavailable, shake detection will not work",
            )
            return false
        }
        val result = sensorManager.registerListener(
            this,
            accelerometer,
            SensorManager.SENSOR_DELAY_GAME,
        )
        if (!result) {
            logger.log(
                LogLevel.Error,
                "Shake detector sensor registration failed, shake detection will not work",
            )
        }
        return result
    }

    override fun stop() {
        resetState()
        sensorManager?.unregisterListener(this)
    }

    override fun setShakeListener(listener: ShakeDetector.Listener?) {
        this.shakeListener = listener
    }

    override fun getShakeListener(): ShakeDetector.Listener? = shakeListener

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onSensorChanged(event: SensorEvent?) {
        event?.takeIf { it.sensor.type == Sensor.TYPE_ACCELEROMETER }?.let {
            val squaredMagnitude =
                calculateSquaredMagnitude(
                    x = it.values[0],
                    y = it.values[1],
                    z = it.values[2],
                )
            val timestamp = it.timestamp

            processSensorReading(squaredMagnitude, timestamp)
        }
    }

    private fun processSensorReading(squaredMagnitude: Float, timestamp: Long) {
        // Skip processing during cooldown to prevent duplicate shake detections
        if (timestamp - lastShakeTime < detectionCooldownNs) return

        if (isSignificantMovement(squaredMagnitude)) {
            recordMovement(timestamp)
        }

        // Remove movements outside the sliding time window
        removeExpiredMovements(timestamp)

        // Check if we have enough movements to constitute a shake
        if (isShakeDetected()) {
            notifyShake(timestamp)
        }
    }

    private fun isSignificantMovement(squaredMagnitude: Float): Boolean =
        squaredMagnitude > squaredShakeAccelerationThreshold

    private fun recordMovement(timestamp: Long) {
        significantMovementsQueue.addLast(timestamp)
    }

    /**
     * Removes movements that have fallen outside the 1.5-second sliding window.
     * This maintains the window by discarding timestamps older than (current - 1.5s).
     */
    private fun removeExpiredMovements(timestamp: Long) {
        val windowStartTime = timestamp - timeWindowNs
        while (significantMovementsQueue.isNotEmpty() && significantMovementsQueue.first() < windowStartTime) {
            significantMovementsQueue.removeFirst()
        }
    }

    private fun isShakeDetected(): Boolean =
        significantMovementsQueue.size >= configProvider.shakeSlop

    /**
     * Calculates squared magnitude of acceleration vector (x² + y² + z²).
     * Using squared values avoids expensive sqrt() while preserving relative ordering.
     */
    private fun calculateSquaredMagnitude(x: Float, y: Float, z: Float): Float =
        x * x + y * y + z * z

    private fun notifyShake(currentTime: Long) {
        shakeListener?.onShake()
        lastShakeTime = currentTime
        resetState()
    }

    private fun resetState() {
        significantMovementsQueue.clear()
    }
}
