import java.util.Properties

val localProps = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.reader()?.use { load(it) }
}

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.kotlinAndroid)
    alias(libs.plugins.composeCompiler)
    id("com.facebook.react")
    alias(libs.plugins.googleServices)
    alias(libs.plugins.crashlytics)
    id("sh.measure.android.gradle")
}

val versionProps = Properties().apply {
    rootProject.file("version.properties").reader().use { load(it) }
}

android {
    namespace = "sh.frankenstein.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "sh.frankenstein.android"
        minSdk = 24
        targetSdk = 36
        versionCode = providers.exec {
            commandLine("git", "rev-list", "--count", "HEAD")
        }.standardOutput.asText.get().trim().toInt()
        versionName = versionProps.getProperty("VERSION_NAME")

        ndk {
            abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")
        }
    }

    signingConfigs {
        getByName("debug") {
            storeFile = rootProject.file("debug.keystore")
        }
        create("release") {
            storeFile = rootProject.file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            manifestPlaceholders["measureApiKey"] = localProps.getProperty("measure.debug.apiKey", "")
            manifestPlaceholders["measureApiUrl"] = localProps.getProperty("measure.debug.apiUrl", "")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
            manifestPlaceholders["measureApiKey"] = localProps.getProperty("measure.release.apiKey", "")
            manifestPlaceholders["measureApiUrl"] = localProps.getProperty("measure.release.apiUrl", "")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
        jniLibs {
            pickFirsts += "**/libc++_shared.so"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

react {
    reactNativeDir = file("${rootDir}/react_native/node_modules/react-native")
    codegenDir = file("${rootDir}/react_native/node_modules/@react-native/codegen")
    root = file("${rootDir}/react_native")
    autolinkLibrariesWithApp()
}

// RNGP skips JS bundling for debug builds (expects Metro dev server).
// This task bundles the JS into the assets directory so the app works without Metro.
val bundleReactNativeDebug by tasks.registering(Exec::class) {
    val rnDir = file("${rootDir}/react_native")
    val bundleOutput = file("src/main/assets/index.android.bundle")
    workingDir(rnDir)
    commandLine(
        "npx", "react-native", "bundle",
        "--platform", "android",
        "--dev", "false",
        "--entry-file", "index.js",
        "--bundle-output", bundleOutput.absolutePath,
    )
    inputs.files(fileTree(rnDir) { include("index.js", "src/**/*.js", "src/**/*.ts", "src/**/*.tsx") })
    outputs.file(bundleOutput)
}

afterEvaluate {
    tasks.named("mergeDebugAssets") { dependsOn(bundleReactNativeDebug) }
}

dependencies {
    implementation("sh.measure:measure-android:0.18.0-SNAPSHOT")
    implementation(project(":kmp"))
    implementation(project(":flutter"))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material.icons)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.fragment)
    implementation(libs.material)
    implementation(libs.viewpager2)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // React Native (versions managed by RNGP)
    implementation("com.facebook.react:react-android")
    implementation("com.facebook.react:hermes-android")

    // AppCompat (required by React Native views)
    implementation(libs.androidx.appcompat)

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.crashlytics)
}
