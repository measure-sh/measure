package sh.measure.android.utils

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.telephony.TelephonyManager

internal interface SystemServiceProvider {
    val connectivityManager: ConnectivityManager?
    val telephonyManager: TelephonyManager?
    val activityManager: ActivityManager?
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
}
