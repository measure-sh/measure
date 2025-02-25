package sh.measure.android.utils

import android.app.ActivityManager
import android.content.Context
import android.hardware.SensorManager
import android.net.ConnectivityManager
import android.os.PowerManager
import android.telephony.TelephonyManager

internal interface SystemServiceProvider {
    val powerManager: PowerManager?
    val connectivityManager: ConnectivityManager?
    val telephonyManager: TelephonyManager?
    val activityManager: ActivityManager?
    val sensorManager: SensorManager?
}

internal class SystemServiceProviderImpl(private val context: Context) : SystemServiceProvider {
    override val activityManager: ActivityManager? by lazy(mode = LazyThreadSafetyMode.NONE) {
        runCatching { context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager }.getOrNull()
    }

    override val connectivityManager: ConnectivityManager? by lazy(mode = LazyThreadSafetyMode.NONE) {
        runCatching { context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager }.getOrNull()
    }

    override val telephonyManager: TelephonyManager? by lazy(mode = LazyThreadSafetyMode.NONE) {
        runCatching { context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager }.getOrNull()
    }

    override val powerManager: PowerManager? by lazy(mode = LazyThreadSafetyMode.NONE) {
        runCatching { context.getSystemService(Context.POWER_SERVICE) as? PowerManager }.getOrNull()
    }

    override val sensorManager: SensorManager? by lazy(mode = LazyThreadSafetyMode.NONE) {
        runCatching { context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager }.getOrNull()
    }
}
