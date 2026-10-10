package sh.measure.android.attributes

import sh.measure.android.utils.ValidationLimits

private val stringAttributeLimits = mapOf(
    Attribute.THREAD_NAME to ValidationLimits.THREAD_NAME,
    Attribute.USER_ID_KEY to ValidationLimits.USER_ID,
    Attribute.DEVICE_NAME_KEY to ValidationLimits.DEVICE_NAME,
    Attribute.DEVICE_MODEL_KEY to ValidationLimits.DEVICE_MODEL,
    Attribute.DEVICE_MANUFACTURER_KEY to ValidationLimits.DEVICE_MANUFACTURER,
    Attribute.DEVICE_LOCALE_KEY to ValidationLimits.DEVICE_LOCALE,
    Attribute.APP_VERSION_KEY to ValidationLimits.APP_VERSION,
    Attribute.APP_BUILD_KEY to ValidationLimits.APP_BUILD,
    Attribute.NETWORK_PROVIDER_KEY to ValidationLimits.NETWORK_PROVIDER,
    Attribute.PATCH_VERSION_KEY to ValidationLimits.PATCH_VERSION,
)

/**
 * Truncates the attributes collected by the SDK to the limits enforced by the backend.
 */
internal fun MutableMap<String, Any?>.truncateToLimits() {
    stringAttributeLimits.forEach { (key, limit) ->
        val value = this[key]
        if (value is String && value.length > limit) {
            this[key] = value.take(limit)
        }
    }
}
