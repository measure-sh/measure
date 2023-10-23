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
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }
}

dependencies {
    compileOnly("androidx.fragment:fragment-ktx:1.2.5")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.5.1")

    implementation("androidx.annotation:annotation:1.7.0")
    implementation("com.squareup.okio:okio:3.3.0")
    implementation(platform("com.squareup.okhttp3:okhttp-bom:4.11.0"))
    implementation("com.squareup.okhttp3:okhttp")
    implementation("com.squareup.okhttp3:logging-interceptor")
    implementation("com.squareup.curtains:curtains:1.2.4")

    testImplementation("org.mockito.kotlin:mockito-kotlin:5.1.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("androidx.test.ext:junit-ktx:1.1.5")
    testImplementation("org.robolectric:robolectric:4.9.2")
    testImplementation("androidx.fragment:fragment-testing:1.2.5")

    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test:runner:1.5.2")
    androidTestImplementation("androidx.test:rules:1.5.0")
}