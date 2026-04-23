package sh.measure.android

import android.os.PowerManager

// Base interface for thermal state management
internal interface ThermalStateManager {
    fun register(powerManager: PowerManager?)
    fun unregister(powerManager: PowerManager?)
    val thermalThrottlingEnabled: Boolean
}
