package sh.measure.android.funnels

import kotlinx.serialization.Serializable

/**
 * Represents a funnel event triggered when a user reaches a specific step in a funnel.
 */
@Serializable
internal data class FunnelData(
    val name: String,
)
