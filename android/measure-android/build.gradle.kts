plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.android.test) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.kotlinx.binary.compatibility.validator) apply false
    alias(libs.plugins.diffplug.spotless) apply false
    alias(libs.plugins.compose) apply false
    alias(libs.plugins.androidx.baselineprofile) apply false
}