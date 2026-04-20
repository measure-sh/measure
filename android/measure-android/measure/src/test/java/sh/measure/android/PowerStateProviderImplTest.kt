package sh.measure.android

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Looper
import android.os.PowerManager
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.logger.Logger
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.SystemServiceProviderImpl

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [Build.VERSION_CODES.Q])
class PowerStateProviderImplTest {

    private val context: Context = InstrumentationRegistry.getInstrumentation().context
    private val logger: Logger = NoopLogger()
    private val systemServiceProvider: SystemServiceProvider = SystemServiceProviderImpl(context)
    private val powerManager: PowerManager? = systemServiceProvider.powerManager
    private val powerStateProvider: PowerStateProviderImpl = PowerStateProviderImpl(
        logger,
        context,
        systemServiceProvider,
    )

    @Test
    fun `register initializes power save mode state`() {
        shadowOf(powerManager).setIsPowerSaveMode(true)

        powerStateProvider.register()
        assertEquals(true, powerStateProvider.lowPowerModeEnabled)
    }

    @Test
    fun `register initializes thermal state`() {
        shadowOf(powerManager).setCurrentThermalStatus(PowerManager.THERMAL_STATUS_SEVERE)
        powerStateProvider.register()

        assertEquals(true, powerStateProvider.thermalThrottlingEnabled)
    }

    @Test
    fun `power save mode broadcast updates state`() {
        // Given initially power save mode is not enabled
        shadowOf(powerManager).setIsPowerSaveMode(false)
        powerStateProvider.register()

        // When power save mode is enabled
        shadowOf(powerManager).setIsPowerSaveMode(true)
        val intent = Intent(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
        context.sendBroadcast(intent)
        shadowOf(Looper.getMainLooper()).idle()

        // Then
        assertEquals(true, powerStateProvider.lowPowerModeEnabled)

        // When power save mode is disabled
        shadowOf(powerManager).setIsPowerSaveMode(false)
        context.sendBroadcast(intent)
        shadowOf(Looper.getMainLooper()).idle()

        assertEquals(false, powerStateProvider.lowPowerModeEnabled)
    }

    @Test
    fun `thermal status changes throttling state`() {
        powerStateProvider.register()
        assertEquals(false, powerStateProvider.thermalThrottlingEnabled)

        shadowOf(powerManager).setCurrentThermalStatus(PowerManager.THERMAL_STATUS_SEVERE)
        assertEquals(true, powerStateProvider.thermalThrottlingEnabled)

        shadowOf(powerManager).setCurrentThermalStatus(PowerManager.THERMAL_STATUS_MODERATE)
        assertEquals(false, powerStateProvider.thermalThrottlingEnabled)
    }

    @Test
    fun `unregister removes thermal state listener`() {
        powerStateProvider.register()
        assertEquals(1, shadowOf(powerManager).thermalStatusListeners.size)

        powerStateProvider.unregister()
        assertEquals(0, shadowOf(powerManager).thermalStatusListeners.size)
    }
}
