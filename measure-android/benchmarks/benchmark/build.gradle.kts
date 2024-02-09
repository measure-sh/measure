plugins {
    id("com.android.test")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "sh.measure.benchmark"
    compileSdk = 34

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }

    defaultConfig {
        minSdk = 23
        targetSdk = 34

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        create("benchmark") {
            isDebuggable = false
            signingConfig = getByName("debug").signingConfig
            matchingFallbacks += listOf("release")
        }
    }
    flavorDimensions += "measure"
    productFlavors {
        create("measureEnabled") {
            dimension = "measure"
        }
        create("measureDisabled") {
            dimension = "measure"
        }
    }

    targetProjectPath = ":benchmarks:app"
    experimentalProperties["android.experimental.self-instrumenting"] = true
}

dependencies {
    implementation("androidx.test.ext:junit:1.1.5")
    implementation("androidx.test.espresso:espresso-core:3.5.1")
    implementation("androidx.test.uiautomator:uiautomator:2.2.0")
    implementation("androidx.benchmark:benchmark-macro-junit4:1.2.3")
}

androidComponents {
    beforeVariants(selector().all()) {
        it.enable = it.buildType == "benchmark"
    }
}