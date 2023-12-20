plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    kotlin("plugin.serialization")
}
apply(from = "publish_local.gradle")

private val measureSdkVersion = "\"0.0.1-SNAPSHOT\""

android {
    namespace = "sh.measure.android"
    compileSdk = 33

    defaultConfig {
        minSdk = 21

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        defaultConfig {
            manifestPlaceholders["measure_url"] = properties["measure_url"]?.toString() ?: ""
            buildConfigField("String", "MEASURE_SDK_VERSION", measureSdkVersion)
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
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
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    // Compile only, as we don't want to include the fragment dependency in the final artifact.
    compileOnly("androidx.fragment:fragment-ktx:1.2.5")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.5.1")
    implementation("androidx.core:core-ktx:1.6.0")

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
    testImplementation("androidx.test:rules:1.5.0")

    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test:runner:1.5.2")
}