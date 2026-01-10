package sh.measure.android.config

import sh.measure.android.events.EventType

internal object DefaultConfig {
    const val ENABLE_LOGGING: Boolean = false
    const val TRACK_ACTIVITY_INTENT_DATA: Boolean = false
    const val AUTO_START: Boolean = true
    const val MAX_ESTIMATED_DISK_USAGE_IN_MB: Int = 50 // 50MB
    val DISALLOWED_CUSTOM_HEADERS: List<String> =
        listOf("Content-Type", "msr-req-id", "Authorization", "Content-Length")
    const val ENABLE_FULL_COLLECTION_MODE: Boolean = false
    val JOURNEY_EVENTS = listOf(
        EventType.LIFECYCLE_ACTIVITY,
        EventType.LIFECYCLE_FRAGMENT,
        EventType.SCREEN_VIEW,
    )
}
