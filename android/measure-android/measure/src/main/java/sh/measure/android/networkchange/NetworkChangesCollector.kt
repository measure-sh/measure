package sh.measure.android.networkchange

import android.Manifest
import android.Manifest.permission.READ_BASIC_PHONE_STATE
import android.Manifest.permission.READ_PHONE_STATE
import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET
import android.net.NetworkCapabilities.TRANSPORT_CELLULAR
import android.net.NetworkCapabilities.TRANSPORT_VPN
import android.net.NetworkCapabilities.TRANSPORT_WIFI
import android.net.NetworkRequest
import android.os.Build
import android.telephony.TelephonyManager
import androidx.annotation.VisibleForTesting
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.getNetworkGeneration
import sh.measure.android.utils.hasPermission
import sh.measure.android.utils.hasPhoneStatePermission

/**
 * Monitors changes in network. It is enabled only when the app is granted the
 * ACCESS_NETWORK_STATE permission and the device is running on Android M (SDK 23) or a higher version.
 *
 * Tracking of [NetworkChangeData.network_generation] is limited to [NetworkType.CELLULAR] for Android
 * M (SDK 23) and later. This requires the app to hold the [READ_PHONE_STATE] permission, which is
 * a runtime permission. In case the user denies this permission,
 * [NetworkChangeData.network_generation] will be null. For devices running
 * Android Tiramisu (SDK 33) or later, [READ_BASIC_PHONE_STATE] permission is sufficient, which does
 * not require a runtime permissions.
 *
 * The SDK does not add any new permissions to the app. It only uses the permissions that the app
 * already has.
 */
internal class NetworkChangesCollector(
    private val context: Context,
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val networkStateProvider: NetworkStateProvider,
) {
    private var currentNetworkType: String = NetworkType.UNKNOWN
    private var currentNetworkGeneration: String = NetworkGeneration.UNKNOWN
    private val telephonyManager: TelephonyManager? by lazy(mode = LazyThreadSafetyMode.NONE) {
        systemServiceProvider.telephonyManager
    }
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    @SuppressLint("MissingPermission")
    fun register() {
        try {
            when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.N -> {
                    if (hasPermission(context, Manifest.permission.ACCESS_NETWORK_STATE)) {
                        val connectivityManager =
                            systemServiceProvider.connectivityManager ?: return
                        val networkCallback = networkCallback()
                        this.networkCallback = networkCallback
                        connectivityManager.registerDefaultNetworkCallback(networkCallback)
                    }
                }

                else -> {
                    val connectivityManager = systemServiceProvider.connectivityManager ?: return
                    if (hasPermission(context, Manifest.permission.ACCESS_NETWORK_STATE)) {
                        val networkCallback = networkCallback()
                        this.networkCallback = networkCallback
                        connectivityManager.registerNetworkCallback(
                            NetworkRequest.Builder().addTransportType(TRANSPORT_CELLULAR)
                                .addTransportType(TRANSPORT_WIFI).addTransportType(TRANSPORT_VPN)
                                .addCapability(NET_CAPABILITY_INTERNET).build(),
                            networkCallback,
                        )
                    }
                }
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "NetworkChangesCollector failed to register", e)
        }
    }

    fun unregister() {
        networkCallback?.let { callback ->
            systemServiceProvider.connectivityManager?.unregisterNetworkCallback(callback)
            networkCallback = null
        }
    }

    private fun networkCallback() = object : ConnectivityManager.NetworkCallback() {
        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities,
        ) {
            val newNetworkType = getNetworkType(networkCapabilities)
            val previousNetworkType = currentNetworkType
            val previousNetworkGeneration = currentNetworkGeneration
            val newNetworkGeneration =
                getNetworkGenerationIfAvailable(newNetworkType) ?: NetworkGeneration.UNKNOWN
            val networkProvider = getNetworkOperatorName(newNetworkType) ?: NetworkProvider.UNKNOWN
            networkStateProvider.setNetworkState(
                NetworkState(newNetworkType, newNetworkGeneration, networkProvider),
            )

            // for Android O+, the callback is called as soon as it's registered. However, we
            // only want to track changes.
            // This also means, the first change event will contain non-null previous states
            // for Android O+.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (currentNetworkType == NetworkType.UNKNOWN) {
                    currentNetworkType = newNetworkType
                    currentNetworkGeneration = newNetworkGeneration
                    return
                }
            }

            // only track significant changes
            if (!shouldTrackNetworkChange(
                    newNetworkType,
                    previousNetworkType,
                    newNetworkGeneration,
                    previousNetworkGeneration,
                )
            ) {
                return
            }

            signalProcessor.track(
                type = EventType.NETWORK_CHANGE,
                timestamp = timeProvider.now(),
                data = NetworkChangeData(
                    previous_network_type = previousNetworkType,
                    network_type = newNetworkType,
                    previous_network_generation = previousNetworkGeneration,
                    network_generation = newNetworkGeneration,
                    network_provider = networkProvider,
                ),
            )
            currentNetworkType = newNetworkType
            currentNetworkGeneration = newNetworkGeneration
        }

        override fun onLost(network: Network) {
            val previousNetworkType = currentNetworkType
            val previousNetworkGeneration = currentNetworkGeneration
            val newNetworkType = NetworkType.NO_NETWORK
            networkStateProvider.setNetworkState(
                NetworkState(newNetworkType, NetworkGeneration.UNKNOWN, NetworkProvider.UNKNOWN),
            )
            if (previousNetworkType == newNetworkType) {
                return
            }
            signalProcessor.track(
                type = EventType.NETWORK_CHANGE,
                timestamp = timeProvider.now(),
                data = NetworkChangeData(
                    previous_network_type = previousNetworkType,
                    network_type = newNetworkType,
                    previous_network_generation = previousNetworkGeneration,
                    network_generation = NetworkGeneration.UNKNOWN,
                    network_provider = NetworkGeneration.UNKNOWN,
                ),
            )
            currentNetworkType = newNetworkType
            currentNetworkGeneration = NetworkGeneration.UNKNOWN
        }
    }

    private fun getNetworkOperatorName(networkType: String): String? {
        if (networkType != NetworkType.CELLULAR) return null
        val name = telephonyManager?.networkOperatorName
        if (name?.isBlank() == true) {
            return null
        }
        return name
    }

    @VisibleForTesting(otherwise = VisibleForTesting.PRIVATE)
    internal fun shouldTrackNetworkChange(
        newNetworkType: String,
        previousNetworkType: String?,
        newNetworkGeneration: String?,
        previousNetworkGeneration: String?,
    ): Boolean = when {
        // track if network type has changed
        previousNetworkType != newNetworkType -> {
            true
        }

        // track if network type is cellular, but network generation has changed
        newNetworkType == NetworkType.CELLULAR && newNetworkGeneration != null && newNetworkGeneration != previousNetworkGeneration -> {
            true
        }

        else -> {
            false
        }
    }

    @SuppressLint("MissingPermission")
    private fun getNetworkGenerationIfAvailable(networkType: String): String? {
        if (networkType != NetworkType.CELLULAR) return null
        if (hasPhoneStatePermission(context)) {
            return telephonyManager?.getNetworkGeneration()
        }
        return null
    }

    private fun getNetworkType(networkCapabilities: NetworkCapabilities) = when {
        networkCapabilities.hasTransport(TRANSPORT_WIFI) -> NetworkType.WIFI
        networkCapabilities.hasTransport(TRANSPORT_CELLULAR) -> NetworkType.CELLULAR
        networkCapabilities.hasTransport(TRANSPORT_VPN) -> NetworkType.VPN
        else -> NetworkType.UNKNOWN
    }
}
