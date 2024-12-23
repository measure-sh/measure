package sh.measure.android

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.UiDevice
import okhttp3.Headers
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.config.MeasureConfig

/**
 * A helper class to interact with the app under test. This class abstracts how the user
 * interactions are performed on the app and allows the test code to focus on the test logic.
 */
class EventsTestRobot {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.context.applicationContext
    private val device = UiDevice.getInstance(instrumentation)

    fun initializeMeasure(config: MeasureConfig = MeasureConfig()) {
        Measure.initForInstrumentationTest(
            TestMeasureInitializer(
                application = context as Application,
                inputConfig = config,
            ),
        )
    }

    fun clickButton() {
        val button = device.findObject(By.res("sh.measure.android.test", "button"))
        button.click()
        device.waitForIdle()
    }

    fun clickComposeButton() {
        val composeButton = device.findObject(By.res("compose_button"))
        composeButton.click()
        device.waitForIdle()
    }

    fun composeScrollDown() {
        val composeView = device.findObject(By.res("compose_scroll"))
        composeView.scroll(Direction.DOWN, 1.0f)
        device.waitForIdle()
    }

    fun longClickButton() {
        val button = device.findObject(By.res("sh.measure.android.test", "button"))
        button.longClick()
        device.waitForIdle()
    }

    fun scrollDown() {
        val scrollView = device.findObject(By.res("sh.measure.android.test", "scroll_view"))
        scrollView.scroll(Direction.DOWN, 1.0f)
        device.waitForIdle()
    }

    fun pressHomeButton() {
        device.pressHome()
        device.waitForIdle()
    }

    fun makeNetworkRequest(
        activity: TestActivity,
        url: String,
        headers: Headers = Headers.Builder().build(),
        requestBody: String? = null,
    ) {
        activity.makeRequest(url, headers, requestBody)
    }

    fun enableMobileData(enable: Boolean) {
        device.executeShellCommand(if (enable) "svc data enable" else "svc data disable")
    }

    fun enableWiFi(enable: Boolean) {
        device.executeShellCommand(if (enable) "svc wifi enable" else "svc wifi disable")
    }

    fun isInternetAvailable(): Boolean {
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork
        if (network != null) {
            val capabilities = connectivityManager.getNetworkCapabilities(network)
            return capabilities != null && (
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || capabilities.hasTransport(
                    NetworkCapabilities.TRANSPORT_CELLULAR,
                ) || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                )
        }
        return false
    }

    fun grantPermissions(vararg permissions: String) {
        permissions.forEach { grantPermission(it) }
    }

    private fun grantPermission(permission: String) {
        val packageName = instrumentation.targetContext.packageName
        device.executeShellCommand("pm grant $packageName $permission")
    }

    fun disableDefaultExceptionHandler() {
        Thread.setDefaultUncaughtExceptionHandler { _, _ ->
            // Disable default exception handler to prevent crash dialog
        }
    }

    fun crashApp() {
        Thread.getDefaultUncaughtExceptionHandler()!!.uncaughtException(
            Thread.currentThread(),
            RuntimeException("Test exception"),
        )
    }

    fun trackCustomEvent() {
        Measure.trackEvent(
            "custom_event",
            AttributesBuilder().apply {
                "custom_event_key" to "custom_event_value"
            }.build(),
        )
    }

    fun addAttribute(key: String, value: String) {
        Measure.addAttribute("user_defined_attr_key", "user_defined_attr_value")
    }
}
