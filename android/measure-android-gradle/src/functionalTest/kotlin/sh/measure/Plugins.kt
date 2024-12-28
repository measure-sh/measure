package sh.measure

import com.autonomousapps.kit.AbstractGradleProject
import com.autonomousapps.kit.gradle.Plugin

object Plugins {
    @JvmStatic
    val androidApp: Plugin = Plugin("com.android.application")

    @JvmStatic
    val measurePlugin: Plugin =
        Plugin("sh.measure.android.gradle", AbstractGradleProject.PLUGIN_UNDER_TEST_VERSION, true)
}
