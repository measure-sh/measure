import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("multiplatform") version "2.3.20"
    kotlin("native.cocoapods") version "2.3.20"
    id("com.android.kotlin.multiplatform.library") version "8.13.0"
}

group = "sh.measure"
version = "0.1.0"

kotlin {
    androidLibrary {
        namespace = "sh.measure.kmp"
        compileSdk = 36
        minSdk = 21
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    iosX64()
    iosArm64()
    iosSimulatorArm64()

    cocoapods {
        version = project.version.toString()
        summary = "Measure SDK bindings for Kotlin Multiplatform"
        homepage = "https://github.com/measure-sh/measure"
        ios.deploymentTarget = "16.0"
        framework {
            baseName = "MeasureKMP"
            isStatic = true
        }
        pod("measure-sh") {
            source = path(rootProject.file("../../"))
            moduleName = "Measure"
        }
    }

    sourceSets {
        commonMain.dependencies {
        }
        androidMain.dependencies {
            implementation("sh.measure:measure-android")
        }
        appleMain.dependencies {
        }
    }
}

// The CocoaPods plugin omits internal task edges on the local-source-path codepath.
// Published pods don't hit this. Declare them so Gradle 8.13+ validation passes.
val localPodConsumers = tasks.matching {
    it.name.matches(Regex("^(generateDef|podGen|podSetupBuild|podBuild|cinterop).*"))
}
localPodConsumers.configureEach { dependsOn("downloadKotlinNativeDistribution") }
tasks.named("generateDefMeasure") { dependsOn("xcodeVersion") }
tasks.matching { it.name.startsWith("podGen") }.configureEach { dependsOn("generateDefMeasure") }

