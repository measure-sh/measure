@file:Suppress("UnstableApiUsage")

import com.diffplug.gradle.spotless.SpotlessExtension
import com.vanniktech.maven.publish.AndroidSingleVariantLibrary
import com.vanniktech.maven.publish.SonatypeHost

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlinx.binary.compatibility.validator)
    alias(libs.plugins.diffplug.spotless)
    alias(libs.plugins.mavenPublish)
}

private val measureSdkVersion = properties["MEASURE_VERSION_NAME"] as String
private val groupId = properties["GROUP"] as String
private val artifactId = properties["MEASURE_ARTIFACT_ID"] as String

mavenPublishing {
    coordinates(groupId, artifactId, measureSdkVersion)
    publishToMavenCentral(SonatypeHost.CENTRAL_PORTAL, automaticRelease = true)

    configure(
        AndroidSingleVariantLibrary(
            variant = "release",
            sourcesJar = true,
            publishJavadocJar = true,
        ),
    )

    pom {
        name.set("Measure Android SDK")
        description.set("Measure Android SDK")
        inceptionYear.set("2024")
        url.set("https://github.com/measure-sh/measure")
        licenses {
            license {
                name.set("The Apache License, Version 2.0")
                url.set("http://www.apache.org/licenses/LICENSE-2.0.txt")
                distribution.set("http://www.apache.org/licenses/LICENSE-2.0.txt")
            }
        }
        developers {
            developer {
                id.set("measure")
                name.set("measure.sh")
            }
        }
        scm {
            url.set("https://github.com/measure-sh/measure")
            connection.set("scm:git:git://github.com/measure-sh/measure.git")
            developerConnection.set("scm:git:ssh://git@github.com/measure-sh/measure.git")
        }
    }
}

android {
    namespace = "sh.measure.android"
    compileSdk = 35

    defaultConfig {
        minSdk = 21
        testOptions.targetSdk = 35
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        testInstrumentationRunnerArguments["clearPackageData"] = "true"
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        defaultConfig {
            buildConfigField("String", "MEASURE_SDK_VERSION", "\"$measureSdkVersion\"")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "consumer-rules.pro",
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
            execution = "ANDROIDX_TEST_ORCHESTRATOR"
        }
    }
    buildFeatures {
        buildConfig = true
        compose = true
    }
    externalNativeBuild {
        cmake {
            path("CMakeLists.txt")
        }
    }
    packaging {
        jniLibs.pickFirsts += "**/libmeasure-ndk.so"
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.7"
    }
}

extensions.configure<SpotlessExtension>("spotless") {
    plugins.withId("org.jetbrains.kotlin.jvm") {
        configureSpotlessKotlin(this@configure)
    }
    plugins.withId("org.jetbrains.kotlin.android") {
        configureSpotlessKotlin(this@configure)
    }
    kotlinGradle {
        ktlint()
    }
    format("misc") {
        target(
            ".gitignore",
            ".gitattributes",
            ".gitconfig",
            ".editorconfig",
            "*.md",
            "src/**/*.md",
            "docs/**/*.md",
            "src/**/*.properties",
        )
        indentWithSpaces()
        trimTrailingWhitespace()
        endWithNewline()
    }
}

fun configureSpotlessKotlin(spotlessExtension: SpotlessExtension) {
    spotlessExtension.kotlin {
        ktlint().apply {
            editorConfigOverride(
                mapOf(
                    "max_line_length" to 2147483647,
                    "ktlint_function_naming_ignore_when_annotated_with" to "Composable",
                ),
            )
        }
        target("src/**/*.kt")
    }
}

dependencies {
    // Compile only, as we don't want to include the fragment dependency in the final artifact.
    compileOnly(libs.androidx.fragment.ktx)
    compileOnly(libs.androidx.compose.runtime.android)
    compileOnly(libs.androidx.compose.ui)
    compileOnly(libs.androidx.navigation.compose)
    compileOnly(libs.androidx.navigation.fragment)
    compileOnly(libs.squareup.okhttp)

    implementation(libs.kotlinx.serialization.json)

    implementation(libs.androidx.annotation)
    implementation(libs.androidx.core.ktx)
    implementation(libs.squareup.okio)
    implementation(libs.squareup.curtains)

    testImplementation(libs.mockito.kotlin)
    testImplementation(libs.junit)
    testImplementation(libs.androidx.junit.ktx)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.fragment.testing)
    testImplementation(libs.androidx.rules)
    testImplementation(libs.androidx.compose.runtime.android)
    testImplementation(libs.androidx.compose.ui)
    testImplementation(libs.androidx.material3)
    testImplementation(libs.squareup.okhttp.mockwebserver)

    debugImplementation("androidx.compose.ui:ui-test-manifest:1.4.3") {
        isTransitive = false
    }
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.compose.runtime.android)
    androidTestImplementation(libs.androidx.compose.ui)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.material3)
    androidTestImplementation(libs.androidx.lifecycle.process)
    androidTestImplementation(libs.androidx.lifecycle.common)
    androidTestImplementation(libs.androidx.activity.compose)
    androidTestImplementation(libs.androidx.fragment.ktx)
    androidTestImplementation(libs.androidx.navigation.compose)
    androidTestImplementation(libs.androidx.rules)
    androidTestImplementation(libs.androidx.uiautomator)
    androidTestImplementation(libs.squareup.okhttp.mockwebserver)
    androidTestUtil(libs.androidx.orchestrator)
    androidTestImplementation(libs.androidx.benchmark.junit4)
}
