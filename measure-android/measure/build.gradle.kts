plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    kotlin("plugin.serialization")
    id("com.github.gmazzo.buildconfig") version "4.1.2"
}

apply(from = "publish_local.gradle")

buildConfig {
    packageName("sh.measure.android")
    useKotlinOutput { internalVisibility = true }
    buildConfigField(
        type = "String",
        name = "MEASURE_SDK_VERSION",
        value = "\"${properties["MEASURE_SDK_VERSION"]?.toString() ?: ""}\"",
    )
    buildConfigField(
        type = "String",
        name = "MEASURE_BASE_URL",
        value = "\"${properties["MEASURE_BASE_URL"]?.toString() ?: ""}\"",
    )
    buildConfigField(
        type = "String",
        name = "MEASURE_SECRET_TOKEN",
        value = "\"${properties["MEASURE_SECRET_TOKEN"]?.toString() ?: ""}\"",
    )
}

android {
    namespace = "sh.measure.android"
    compileSdk = 33

    defaultConfig {
        minSdk = 21

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.5.1")

    implementation(platform("com.squareup.okhttp3:okhttp-bom:4.11.0"))
    implementation("com.squareup.okhttp3:okhttp")
    implementation("com.squareup.okhttp3:logging-interceptor")

    testImplementation("org.mockito.kotlin:mockito-kotlin:5.1.0")
    testImplementation("junit:junit:4.13.2")
}