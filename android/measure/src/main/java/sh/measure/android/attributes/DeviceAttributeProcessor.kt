package sh.measure.android.attributes

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.system.OsConstants
import sh.measure.android.utils.LocaleProvider
import sh.measure.android.utils.OsSysConfProvider

/**
 * Generates the device attributes such as device name, model, manufacturer, and more. These
 * attributes are expected to be constant during the session and are computed once.
 */
internal class DeviceAttributeProcessor(
    private val context: Context,
    private val localeProvider: LocaleProvider,
    private val osSysConfProvider: OsSysConfProvider,
) : ComputeOnceAttributeProcessor() {
    private val configuration = context.resources.configuration
    private val resources = context.resources

    override fun computeAttributes(): Map<String, Any?> {
        return mapOf(
            Attribute.DEVICE_NAME_KEY to Build.DEVICE,
            Attribute.DEVICE_MODEL_KEY to Build.MODEL,
            Attribute.DEVICE_MANUFACTURER_KEY to Build.MANUFACTURER,
            Attribute.DEVICE_TYPE_KEY to getDeviceType(),
            Attribute.DEVICE_IS_FOLDABLE_KEY to isFoldable(),
            Attribute.DEVICE_IS_PHYSICAL_KEY to isPhysical(),
            Attribute.DEVICE_DENSITY_DPI_KEY to configuration.densityDpi,
            Attribute.DEVICE_WIDTH_PX_KEY to resources.displayMetrics.widthPixels,
            Attribute.DEVICE_HEIGHT_PX_KEY to resources.displayMetrics.heightPixels,
            Attribute.DEVICE_DENSITY_KEY to resources.displayMetrics.density,
            Attribute.DEVICE_LOCALE_KEY to getDeviceLocale(),
            Attribute.OS_NAME_KEY to "android",
            Attribute.OS_VERSION_KEY to Build.VERSION.SDK_INT.toString(),
            Attribute.OS_PAGE_SIZE to getPageSizeKB(),
            Attribute.PLATFORM_KEY to "android",
        )
    }

    // Using heuristics from:
    // https://android-developers.googleblog.com/2023/06/detecting-if-device-is-foldable-tablet.html
    private fun getDeviceType(): String? {
        val sw = configuration.smallestScreenWidthDp
        return when {
            sw == 0 -> null
            sw < 600 -> "phone"
            sw >= 600 -> "tablet"
            else -> null
        }
    }

    // Using heuristics from:
    // https://android-developers.googleblog.com/2023/06/detecting-if-device-is-foldable-tablet.html
    private fun isFoldable(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return context.packageManager.hasSystemFeature(PackageManager.FEATURE_SENSOR_HINGE_ANGLE)
        }
        return false
    }

    /**
     * A simple emulator-detection based on the flutter tools detection logic and a couple of legacy
     * detection systems.
     * Copied from: https://github.com/fluttercommunity/plus_plugins/blob/main/packages/device_info_plus/device_info_plus/android/src/main/kotlin/dev/fluttercommunity/plus/device_info/MethodCallHandlerImpl.kt#L109
     */
    private fun isPhysical(): Boolean {
        val isEmulator = try {
            (
                (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic")) || Build.FINGERPRINT.startsWith(
                    "generic",
                ) || Build.FINGERPRINT.startsWith("unknown") || Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains(
                    "ranchu",
                ) || Build.MODEL.contains("google_sdk") || Build.MODEL.contains("Emulator") || Build.MODEL.contains(
                    "Android SDK built for x86",
                ) || Build.MANUFACTURER.contains("Genymotion") || Build.PRODUCT.contains("sdk") || Build.PRODUCT.contains(
                    "vbox86p",
                ) || Build.PRODUCT.contains("emulator") || Build.PRODUCT.contains("simulator")
                )
        } catch (e: Exception) {
            // assume it's a physical device
            false
        }
        return !isEmulator
    }

    private fun getDeviceLocale(): String {
        return localeProvider.getLocale()
    }

    // Returns page size in KB.
    private fun getPageSizeKB(): Long {
        return osSysConfProvider.get(OsConstants._SC_PAGESIZE) / 1024
    }
}
