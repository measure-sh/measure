package sh.measure.android.networkchange

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import androidx.annotation.RequiresApi
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.getNetworkGeneration
import sh.measure.android.utils.hasPermission
import sh.measure.android.utils.hasPhoneStatePermission

internal interface NetworkInfoProvider {
    fun getNetworkGeneration(networkType: String?): String?
    fun getNetworkType(): String?
    fun getNetworkProvider(networkType: String?): String?
}

internal class NetworkInfoProviderImpl(
    private val context: Context,
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
) : NetworkInfoProvider {

    override fun getNetworkProvider(networkType: String?): String? {
        if (networkType != NetworkType.CELLULAR) return null
        systemServiceProvider.telephonyManager?.networkOperatorName.let {
            if (it.isNullOrBlank()) return null
            return it
        }
    }

    @SuppressLint("MissingPermission")
    override fun getNetworkGeneration(networkType: String?): String? {
        if (networkType != NetworkType.CELLULAR) return null
        return if (hasPhoneStatePermission(context)) {
            systemServiceProvider.telephonyManager?.getNetworkGeneration()
        } else {
            null
        }
    }

    override fun getNetworkType(): String? {
        val connectivityManager = systemServiceProvider.connectivityManager ?: return null
        if (!hasPermission(context, Manifest.permission.ACCESS_NETWORK_STATE)) {
            logger.log(LogLevel.Debug, "No permission to access network state")
            return null
        }
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getNetworkTypeAboveApi23(connectivityManager)
        } else {
            getNetworkTypeBelowApi23(connectivityManager)
        }
    }

    @Suppress("DEPRECATION")
    @SuppressLint("MissingPermission")
    private fun getNetworkTypeBelowApi23(connectivityManager: ConnectivityManager): String {
        val activeNetwork = connectivityManager.activeNetworkInfo ?: return NetworkType.NO_NETWORK
        return when (activeNetwork.type) {
            ConnectivityManager.TYPE_WIFI -> NetworkType.WIFI
            ConnectivityManager.TYPE_MOBILE -> NetworkType.CELLULAR
            ConnectivityManager.TYPE_VPN -> NetworkType.VPN
            else -> NetworkType.UNKNOWN
        }
    }

    @SuppressLint("MissingPermission")
    @RequiresApi(Build.VERSION_CODES.M)
    private fun getNetworkTypeAboveApi23(connectivityManager: ConnectivityManager): String {
        if (!hasPermission(context, Manifest.permission.ACCESS_NETWORK_STATE)) {
            logger.log(LogLevel.Debug, "No permission to access network state")
            return NetworkType.UNKNOWN
        }
        val capabilities =
            connectivityManager.getNetworkCapabilities(connectivityManager.activeNetwork)
                ?: return NetworkType.NO_NETWORK
        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> NetworkType.CELLULAR
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> NetworkType.WIFI
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> NetworkType.VPN
            else -> NetworkType.UNKNOWN
        }
    }
}
