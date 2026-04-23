package sh.measure.android

import android.os.Build
import android.os.PowerManager
import androidx.annotation.RequiresApi

/**
 * An implementation of [ThermalStateManager] for API > Q where
 * [PowerManager.OnThermalStatusChangedListener] is available.
 */
@RequiresApi(Build.VERSION_CODES.Q)
internal class ThermalStateManagerImpl : ThermalStateManager {
    private var currentThermalThrottlingState: Boolean = false

    private val thermalListener = PowerManager.OnThermalStatusChangedListener { status ->
        currentThermalThrottlingState = isThermalThrottlingEnabled(status)
    }

    override fun register(powerManager: PowerManager?) {
        powerManager?.let {
            it.addThermalStatusListener(thermalListener)
            currentThermalThrottlingState = isThermalThrottlingEnabled(it.currentThermalStatus)
        }
    }

    override fun unregister(powerManager: PowerManager?) {
        powerManager?.removeThermalStatusListener(thermalListener)
    }

    override val thermalThrottlingEnabled: Boolean
        get() = currentThermalThrottlingState

    private fun isThermalThrottlingEnabled(status: Int?) = when (status) {
        PowerManager.THERMAL_STATUS_NONE -> false
        PowerManager.THERMAL_STATUS_LIGHT -> false
        PowerManager.THERMAL_STATUS_MODERATE -> false
        PowerManager.THERMAL_STATUS_SEVERE -> true
        PowerManager.THERMAL_STATUS_CRITICAL -> true
        PowerManager.THERMAL_STATUS_EMERGENCY -> true
        PowerManager.THERMAL_STATUS_SHUTDOWN -> true
        else -> false
    }
}
