package sh.measure.android.networkchange

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

@Serializable
internal data class NetworkChangeEvent(
    /**
     * The [NetworkType] of the network that was previously active. This is null if there was no
     * previously active network.
     */
    val previous_network_type: String?,

    /**
     * The [NetworkType] of the network that is now active.
     */
    val network_type: String,

    /**
     * The [NetworkGeneration] of the network that was previously active. Only set for cellular
     * networks.
     */
    val previous_network_generation: String?,

    /**
     * The [NetworkGeneration] of the network that is now active.
     */
    val network_generation: String?,

    /**
     * The name of the network provider that is now active. Only set for cellular networks.
     */
    val network_provider: String?,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient val timestamp: Long = -1L,
    @Transient val thread_name: String = "",
)
