package sh.measure.android.events

import kotlinx.serialization.Serializable

@Serializable
internal data class CustomEventData(
    val name: String,
)
