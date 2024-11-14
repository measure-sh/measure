package sh.measure.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.PowerManager
import androidx.annotation.RequiresApi
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.SystemServiceProvider

internal interface PowerStateProvider {
    fun register()
    fun unregister()
    val lowPowerModeEnabled: Boolean?
    val thermalThrottlingEnabled: Boolean?
}

internal class PowerStateProviderImpl(
    private val logger: Logger,
    private val context: Context,
    private val systemServiceProvider: SystemServiceProvider,
) : PowerStateProvider {
    override var lowPowerModeEnabled: Boolean? = null
        private set
    override var thermalThrottlingEnabled: Boolean? = null
        private set

    private val powerSaveReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == PowerManager.ACTION_POWER_SAVE_MODE_CHANGED) {
                updatePowerState()
            }
        }
    }

    private val thermalListener = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        PowerManager.OnThermalStatusChangedListener { status ->
            thermalThrottlingEnabled = isThermalThrottlingEnabled(status)
        }
    } else {
        null
    }

    override fun register() {
        try {
            updatePowerState()

            val filter = IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
            context.registerReceiver(powerSaveReceiver, filter)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                systemServiceProvider.powerManager?.addThermalStatusListener(thermalListener!!)
                updateThermalState()
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to register power state receiver", e)
        }
    }

    override fun unregister() {
        try {
            context.unregisterReceiver(powerSaveReceiver)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                systemServiceProvider.powerManager?.removeThermalStatusListener(thermalListener!!)
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to unregister power state receiver", e)
        }
    }

    private fun updatePowerState() {
        try {
            val powerManager = systemServiceProvider.powerManager
            lowPowerModeEnabled = powerManager?.isPowerSaveMode
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to update power state", e)
            lowPowerModeEnabled = null
        }
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private fun updateThermalState() {
        try {
            val powerManager = systemServiceProvider.powerManager
            val currentStatus = powerManager?.currentThermalStatus
            thermalThrottlingEnabled = isThermalThrottlingEnabled(currentStatus)
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to update thermal state", e)
            thermalThrottlingEnabled = null
        }
    }

    /**
     * Thermal throttling starts considerably affecting UX from "THERMAL_STATUS_SEVERE" status
     * onwards.
     *
     * @return true if thermal status is severe or worse, false otherwise.
     */
    private fun isThermalThrottlingEnabled(status: Int?) = when (status) {
        PowerManager.THERMAL_STATUS_NONE -> false
        PowerManager.THERMAL_STATUS_LIGHT -> false
        PowerManager.THERMAL_STATUS_MODERATE -> false
        PowerManager.THERMAL_STATUS_SEVERE -> true
        PowerManager.THERMAL_STATUS_CRITICAL -> true
        PowerManager.THERMAL_STATUS_EMERGENCY -> true
        PowerManager.THERMAL_STATUS_SHUTDOWN -> true
        else -> null
    }
}
