package sh.measure.android

import android.os.PowerManager

/**
 * A no-op implementation of [ThermalStateManager], used for API < Q
 * which do not have [PowerManager.OnThermalStatusChangedListener].
 */
internal class NoopThermalStateManager : ThermalStateManager {
    override fun register(powerManager: PowerManager?) {
        // No-op
    }

    override fun unregister(powerManager: PowerManager?) {
        // No-op
    }

    override val thermalThrottlingEnabled: Boolean
        get() = false
}
