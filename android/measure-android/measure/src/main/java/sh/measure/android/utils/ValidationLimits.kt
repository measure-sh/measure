package sh.measure.android.utils

/**
 * Field limits enforced by the backend.
 */
internal object ValidationLimits {
    const val THREAD_NAME = 128
    const val USER_ID = 128
    const val DEVICE_NAME = 32
    const val DEVICE_MODEL = 32

    const val DEVICE_MANUFACTURER = 32
    const val DEVICE_LOCALE = 64
    const val APP_VERSION = 128
    const val APP_BUILD = 32
    const val NETWORK_PROVIDER = 64
    const val PATCH_VERSION = 256

    const val LAUNCHED_ACTIVITY = 127
    const val NETWORK_CHANGE_PROVIDER = 63

    const val ACTIVITY_CLASS_NAME = 128
    const val FRAGMENT_CLASS_NAME = 128
    const val GESTURE_TARGET = 128
    const val GESTURE_TARGET_ID = 128
    const val SCREEN_VIEW_NAME = 1024
    const val HTTP_CLIENT = 32
    const val ANR_SUBJECT = 1024
    const val EXCEPTION_META_BYTES = 4096
}
