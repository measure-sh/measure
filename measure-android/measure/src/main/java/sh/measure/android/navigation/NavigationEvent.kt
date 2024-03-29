package sh.measure.android.navigation

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

@Serializable
internal data class NavigationEvent(
    /**
     * The route that was navigated to.
     */
    val route: String,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient var timestamp: Long = 0L,
)
