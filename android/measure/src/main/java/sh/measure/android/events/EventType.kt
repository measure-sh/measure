package sh.measure.android.events

internal object EventType {
    const val STRING = "string"
    const val EXCEPTION = "exception"
    const val ANR = "anr"
    const val APP_EXIT = "app_exit"
    const val CLICK: String = "gesture_click"
    const val LONG_CLICK: String = "gesture_long_click"
    const val SCROLL: String = "gesture_scroll"
    const val LIFECYCLE_ACTIVITY: String = "lifecycle_activity"
    const val LIFECYCLE_FRAGMENT: String = "lifecycle_fragment"
    const val LIFECYCLE_APP: String = "lifecycle_app"
    const val COLD_LAUNCH: String = "cold_launch"
    const val WARM_LAUNCH: String = "warm_launch"
    const val HOT_LAUNCH: String = "hot_launch"
    const val NETWORK_CHANGE: String = "network_change"
    const val HTTP: String = "http"
    const val MEMORY_USAGE: String = "memory_usage"
    const val TRIM_MEMORY: String = "trim_memory"
    const val CPU_USAGE: String = "cpu_usage"
    const val SCREEN_VIEW: String = "screen_view"
    const val CUSTOM: String = "custom"
}
