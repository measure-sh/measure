plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    id("sh.measure.android.gradle")
}

measure {
    variantFilter {
        if (name.contains("debug")) {
            enabled = false
        }
    }
}

android {
    namespace = "sh.measure.sample"
    compileSdk = 35
    val measureSdkVersion = libs.versions.measure.android.get()
    defaultConfig {
        applicationId = "sh.measure.sample"
        minSdk = 21
        targetSdk = 35
        versionCode = computeVersionCode()
        versionName = measureSdkVersion

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        defaultConfig {
            manifestPlaceholders["MEASURE_API_KEY"] =
                properties["measure_api_key"]?.toString() ?: ""
            manifestPlaceholders["MEASURE_API_URL"] =
                properties["measure_api_url"]?.toString() ?: ""
        }
        debug {
            versionNameSuffix = ".debug"
            isMinifyEnabled = false
            isShrinkResources = false
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.7"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.google.material)

    implementation(libs.androidx.constraintlayout)
    implementation(libs.squareup.okhttp)
    implementation(libs.squareup.okhttp.logging)

    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.runtime.android)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.navigation.fragment.ktx)
    implementation(libs.androidx.activity)

    implementation(project(":measure"))

    debugImplementation(libs.squareup.leakcanary)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit)

    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
/**
 * Computes the version code based on the current system time in minutes since epoch.
 *
 * This is typically a not a good idea, but it's done so that we always get a unique
 * version code for every build so that every time we record data from sample app,
 * it shows up as a separate version on the dashboard.
 */
fun computeVersionCode(): Int {
    return (System.currentTimeMillis() / (1000 * 60)).toInt()
}
