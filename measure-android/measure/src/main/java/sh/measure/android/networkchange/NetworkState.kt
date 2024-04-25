package sh.measure.android.networkchange

internal data class NetworkState(
    val networkType: String,
    val networkGeneration: String?,
    val networkProvider: String?,
)
