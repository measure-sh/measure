package sh.measure.android.events

internal enum class EventType(val value: String) {
    STRING("string"),
    EXCEPTION("exception"),
    ANR("anr"),
    APP_EXIT("app_exit"),
    CLICK("gesture_click"),
    LONG_CLICK("gesture_long_click"),
    SCROLL("gesture_scroll"),
    LIFECYCLE_ACTIVITY("lifecycle_activity"),
    LIFECYCLE_FRAGMENT("lifecycle_fragment"),
    LIFECYCLE_APP("lifecycle_app"),
    COLD_LAUNCH("cold_launch"),
    WARM_LAUNCH("warm_launch"),
    HOT_LAUNCH("hot_launch"),
    NETWORK_CHANGE("network_change"),
    HTTP("http"),
    MEMORY_USAGE("memory_usage"),
    TRIM_MEMORY("trim_memory"),
    CPU_USAGE("cpu_usage"),
    SCREEN_VIEW("screen_view"),
    CUSTOM("custom"),
    BUG_REPORT("bug_report"),
    ;

    companion object {
        fun fromValue(value: String): EventType? = entries.find { it.value == value }
    }
}
