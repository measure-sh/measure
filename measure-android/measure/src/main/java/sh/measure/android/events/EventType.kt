package sh.measure.android.events

object EventType {
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
}