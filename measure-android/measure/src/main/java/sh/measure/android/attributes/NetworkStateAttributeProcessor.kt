package sh.measure.android.attributes

import sh.measure.android.events.Event
import sh.measure.android.networkchange.NetworkInfoProvider

/**
 * Generates the network state attributes. These attributes are expected to change during the
 * session. This class computes the attributes every time [appendAttributes] is called.
 */
internal class NetworkStateAttributeProcessor(
    private val networkInfoProvider: NetworkInfoProvider,
) : AttributeProcessor {
    private val networkTypeKey = "network_type"
    private val networkGenerationKey = "network_generation"
    private val networkProviderNameKey = "network_provider_name"

    private var networkType: String? = null
    private var networkGeneration: String? = null
    private var networkProviderName: String? = null

    override fun appendAttributes(event: Event<*>) {
        computeAttributes()
        event.attributes.apply {
            put(networkTypeKey, networkType)
            put(networkGenerationKey, networkGeneration)
            put(networkProviderNameKey, networkProviderName)
        }
    }

    private fun computeAttributes() {
        val type = networkInfoProvider.getNetworkType()
        networkType = type
        networkGeneration = networkInfoProvider.getNetworkGeneration(type).toString()
        networkProviderName = networkInfoProvider.getNetworkProvider(type)
    }
}
