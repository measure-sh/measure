@file:Suppress("UnstableApiUsage")

import com.facebook.react.ReactSettingsExtension

pluginManagement {
    val flutterSdkPath = run {
        val properties = java.util.Properties()
        file("flutter/.android/local.properties").inputStream().use { properties.load(it) }
        properties.getProperty("flutter.sdk")
    }
    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    // React Native Gradle Plugin
    includeBuild("react_native/node_modules/@react-native/gradle-plugin")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.10.0"
    id("com.facebook.react.settings")
}

extensions.configure<ReactSettingsExtension> {
    autolinkLibrariesFromCommand(
        workingDirectory = file("react_native"),
        lockFiles = files("react_native/package-lock.json", "react_native/package.json"),
    )
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()


        val storageUrl = System.getenv("FLUTTER_STORAGE_BASE_URL") ?: "https://storage.googleapis.com"
        maven(url = "$storageUrl/download.flutter.io")

        // React Native
        maven(url = "${rootDir}/react_native/node_modules/react-native/android")
    }
}

rootProject.name = "FrankensteinApp"
include(":android:app")
include(":kmp")
// Flutter add-to-app integration
include(":flutter")
project(":flutter").projectDir = file("flutter/.android/Flutter")

val flutterSdkPath: String? = java.util.Properties().let { props ->
    file("flutter/.android/local.properties").reader(Charsets.UTF_8).use { props.load(it) }
    props.getProperty("flutter.sdk")
}
apply(from = "$flutterSdkPath/packages/flutter_tools/gradle/module_plugin_loader.gradle")

includeBuild("../../android/measure-android") {
    dependencySubstitution {
        substitute(module("sh.measure:measure-android")).using(project(":measure"))
    }
}

includeBuild("../../kmp/measure-kmp") {
    name = "measure-kmp"
    dependencySubstitution {
        substitute(module("sh.measure:measure-kmp")).using(project(":"))
    }
}
