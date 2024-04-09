package sh.measure.android.attributes

import sh.measure.android.networkchange.NetworkInfoProvider
import sh.measure.android.tracing.InternalTrace

/**
 * Generates the network state attributes. These attributes are expected to change during the
 * session. This class computes the attributes every time [appendAttributes] is called.
 */
internal class NetworkStateAttributeProcessor(
    private val networkInfoProvider: NetworkInfoProvider,
) : AttributeProcessor {
    private var networkType: String? = null
    private var networkGeneration: String? = null
    private var networkProviderName: String? = null

    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        InternalTrace.beginSection("NetworkStateAttributeProcessor.appendAttributes")
        computeAttributes()
        attributes.apply {
            put(Attribute.NETWORK_TYPE_KEY, networkType)
            put(Attribute.NETWORK_GENERATION_KEY, networkGeneration)
            put(Attribute.NETWORK_PROVIDER_NAME_KEY, networkProviderName)
        }
        InternalTrace.endSection()
    }

    private fun computeAttributes() {
        val type = networkInfoProvider.getNetworkType()
        networkType = type
        networkGeneration = networkInfoProvider.getNetworkGeneration(type).toString()
        networkProviderName = networkInfoProvider.getNetworkProvider(type)
    }
}
