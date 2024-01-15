package sh.measure

import com.autonomousapps.kit.gradle.Plugin

object Plugins {
  @JvmStatic val androidApp: Plugin = Plugin("com.android.application")
  @JvmStatic val measurePlugin: Plugin = Plugin("sh.measure.plugin", "0.0.1", true)
}
