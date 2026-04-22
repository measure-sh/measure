package sh.measure.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.PowerManager
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.SystemServiceProvider
import java.util.concurrent.atomic.AtomicBoolean

internal interface PowerStateProvider {
    fun register()
    fun unregister()
    val lowPowerModeEnabled: Boolean?
    val thermalThrottlingEnabled: Boolean
}

internal class PowerStateProviderImpl(
    private val logger: Logger,
    private val context: Context,
    private val systemServiceProvider: SystemServiceProvider,
) : PowerStateProvider {
    private val isRegistered = AtomicBoolean(false)
    override var lowPowerModeEnabled: Boolean? = null
        private set

    override val thermalThrottlingEnabled: Boolean
        get() = thermalStateManager.thermalThrottlingEnabled

    private val thermalStateManager: ThermalStateManager =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ThermalStateManagerImpl()
        } else {
            NoopThermalStateManager()
        }

    private val powerSaveReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == PowerManager.ACTION_POWER_SAVE_MODE_CHANGED) {
                updatePowerState()
            }
        }
    }

    override fun register() {
        if (isRegistered.get()) {
            return
        }
        isRegistered.set(true)
        try {
            updatePowerState()
            val filter = IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
            context.registerReceiver(powerSaveReceiver, filter)
            thermalStateManager.register(systemServiceProvider.powerManager)
        } catch (e: Exception) {
            logger.log(LogLevel.Debug, "Failed to register power state receiver", e)
        }
    }

    override fun unregister() {
        isRegistered.set(false)
        try {
            context.unregisterReceiver(powerSaveReceiver)
            thermalStateManager.unregister(systemServiceProvider.powerManager)
        } catch (e: Exception) {
            logger.log(LogLevel.Debug, "Failed to unregister power state receiver", e)
        }
    }

    private fun updatePowerState() {
        try {
            val powerManager = systemServiceProvider.powerManager
            lowPowerModeEnabled = powerManager?.isPowerSaveMode
        } catch (e: Exception) {
            logger.log(LogLevel.Debug, "Failed to update power state", e)
            lowPowerModeEnabled = null
        }
    }
}
