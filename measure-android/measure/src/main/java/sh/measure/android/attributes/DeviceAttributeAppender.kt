package sh.measure.android.attributes

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.LocaleProvider

/**
 * Generates the device attributes such as device name, model, manufacturer, and more. These
 * attributes are expected to be constant during the session and are computed once.
 */
internal class DeviceAttributeAppender(
    private val logger: Logger,
    private val context: Context,
    private val localeProvider: LocaleProvider,
) : ComputeOnceAttributeAppender() {
    private val deviceNameKey = "device_name"
    private val deviceModelKey = "device_model"
    private val deviceManufacturerKey = "device_manufacturer"
    private val deviceTypeKey = "device_type"
    private val deviceIsFoldableKey = "device_is_foldable"
    private val deviceIsPhysicalKey = "device_is_physical"
    private val deviceDensityDpiKey = "device_density_dpi"
    private val deviceWidthPxKey = "device_width_px"
    private val deviceHeightPxKey = "device_height_px"
    private val deviceDensityKey = "device_density"
    private val deviceLocaleKey = "device_locale"
    private val osNameKey = "os_name"
    private val osVersionKey = "os_version"
    private val platformKey = "platform"
    private val configuration = context.resources.configuration
    private val resources = context.resources

    override fun computeAttributes(): Map<String, Any?> {
        return mapOf(
            deviceNameKey to Build.DEVICE,
            deviceModelKey to Build.MODEL,
            deviceManufacturerKey to Build.MANUFACTURER,
            deviceTypeKey to getDeviceType(),
            deviceIsFoldableKey to isFoldable(),
            deviceIsPhysicalKey to isPhysical(),
            deviceDensityDpiKey to configuration.densityDpi,
            deviceWidthPxKey to resources.displayMetrics.widthPixels,
            deviceHeightPxKey to resources.displayMetrics.heightPixels,
            deviceDensityKey to resources.displayMetrics.density,
            deviceLocaleKey to getDeviceLocale(),
            osNameKey to "android",
            osVersionKey to Build.VERSION.SDK_INT.toString(),
            platformKey to "android",
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
            ((Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic")) || Build.FINGERPRINT.startsWith(
                "generic",
            ) || Build.FINGERPRINT.startsWith("unknown") || Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains(
                "ranchu",
            ) || Build.MODEL.contains("google_sdk") || Build.MODEL.contains("Emulator") || Build.MODEL.contains(
                "Android SDK built for x86",
            ) || Build.MANUFACTURER.contains("Genymotion") || Build.PRODUCT.contains("sdk") || Build.PRODUCT.contains(
                "vbox86p",
            ) || Build.PRODUCT.contains("emulator") || Build.PRODUCT.contains("simulator"))
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Error detecting emulator", e)
            // assume it's a physical device
            false
        }
        return !isEmulator
    }

    private fun getDeviceLocale(): String {
        return localeProvider.getLocale()
    }
}