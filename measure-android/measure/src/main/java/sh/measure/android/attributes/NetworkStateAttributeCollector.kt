package sh.measure.android.attributes

import sh.measure.android.networkchange.NetworkInfoProvider

/**
 * Generates the network state attributes. These attributes are expected to change during the
 * session. This class computes the attributes every time [append] is called.
 */
internal class NetworkStateAttributeCollector(
    private val networkInfoProvider: NetworkInfoProvider,
) : AttributeCollector {
    private val networkTypeKey = "network_type"
    private val networkGenerationKey = "network_generation"
    private val networkProviderNameKey = "network_provider_name"

    private var networkType: String? = null
    private var networkGeneration: String? = null
    private var networkProviderName: String? = null

    override fun append(attrs: MutableMap<String, Any?>) {
        computeAttributes()
        attrs.apply {
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
