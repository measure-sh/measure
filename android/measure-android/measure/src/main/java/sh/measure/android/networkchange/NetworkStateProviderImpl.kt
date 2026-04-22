package sh.measure.android.networkchange

/**
 * Retrieves the current network state.
 */
internal interface NetworkStateProvider {

    /**
     * Gets the current network state.
     *
     * @return The current network state.
     */
    fun getNetworkState(): NetworkState?

    /**
     * Sets the network state.
     *
     * @param networkState The network state to set.
     */
    fun setNetworkState(networkState: NetworkState)
}

internal class NetworkStateProviderImpl(
    private val initialNetworkStateProvider: InitialNetworkStateProvider,
) : NetworkStateProvider {
    private var networkState: NetworkState? = null

    fun init() {
        initialNetworkStateProvider.getNetworkType()?.let {
            val networkGen = initialNetworkStateProvider.getNetworkGeneration(it) ?: NetworkGeneration.UNKNOWN
            val networkProvider = initialNetworkStateProvider.getNetworkProvider(it) ?: NetworkProvider.UNKNOWN
            networkState = NetworkState(it, networkGen, networkProvider)
        }
    }

    override fun setNetworkState(networkState: NetworkState) {
        this.networkState = networkState
    }

    override fun getNetworkState(): NetworkState? = networkState
}
