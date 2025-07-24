package sh.measure.android.attributes

import android.os.Build
import sh.measure.android.utils.LocaleProvider

// Similar to [DeviceAttributeProcessor] but used only for spans as spans requires a subset of the
// attributes collected for events.
internal class SpanDeviceAttributeProcessor(
    private val localeProvider: LocaleProvider,
) : ComputeOnceAttributeProcessor() {
    override fun computeAttributes(): Map<String, Any?> = mapOf(
        Attribute.DEVICE_NAME_KEY to Build.DEVICE,
        Attribute.DEVICE_MODEL_KEY to Build.MODEL,
        Attribute.DEVICE_MANUFACTURER_KEY to Build.MANUFACTURER,
        Attribute.DEVICE_LOCALE_KEY to getDeviceLocale(),
        Attribute.OS_NAME_KEY to "android",
        Attribute.OS_VERSION_KEY to Build.VERSION.SDK_INT.toString(),
        Attribute.PLATFORM_KEY to "android",
    )

    private fun getDeviceLocale(): String = localeProvider.getLocale()
}
