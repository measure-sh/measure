package sh.measure.android.navigation

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

@Serializable
internal data class NavigationEvent(
    /**
     * The route that was navigated to.
     */
    val route: String,
    @Transient var timestamp: Long = 0L,
    @Transient var thread_name: String = "",
)
