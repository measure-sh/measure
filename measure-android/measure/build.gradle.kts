@file:Suppress("UnstableApiUsage")

import com.diffplug.gradle.spotless.SpotlessExtension

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    kotlin("plugin.serialization")
    id("binary-compatibility-validator")
    id("com.diffplug.spotless")
    id("maven-publish")
}

val measureSdkVersion = properties["MEASURE_VERSION_NAME"] as String
publishing {
    publications {
        create<MavenPublication>("maven") {
            groupId = properties["GROUP"] as String
            artifactId = properties["MEASURE_ARTIFACT_ID"] as String
            version = measureSdkVersion

            afterEvaluate {
                from(components["release"])
            }
        }
    }

    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/measure-sh/measure")
            credentials {
                username = System.getenv("GITHUB_ACTOR")
                password = System.getenv("GITHUB_TOKEN")
            }
        }
    }
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
        defaultConfig {
            manifestPlaceholders["measure_url"] = properties["measure_url"]?.toString() ?: ""
            buildConfigField("String", "MEASURE_SDK_VERSION", "\"$measureSdkVersion\"")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
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
                mapOf("max_line_length" to 2147483647),
            )
        }
        target("src/**/*.kt")
    }
}

dependencies {
    // Compile only, as we don't want to include the fragment dependency in the final artifact.
    compileOnly("androidx.fragment:fragment-ktx:1.2.5")
    implementation("androidx.core:core-ktx:1.6.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")

    implementation("androidx.annotation:annotation:1.7.1")
    implementation("com.squareup.okio:okio:3.3.0")
    implementation(platform("com.squareup.okhttp3:okhttp-bom:4.11.0"))
    implementation("com.squareup.okhttp3:okhttp")
    implementation("com.squareup.okhttp3:logging-interceptor")
    implementation("com.squareup.curtains:curtains:1.2.4")

    testImplementation("org.mockito.kotlin:mockito-kotlin:5.1.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("androidx.test.ext:junit-ktx:1.1.5")
    testImplementation("org.robolectric:robolectric:4.11.1")
    testImplementation("androidx.fragment:fragment-testing:1.2.5")
    testImplementation("androidx.test:rules:1.5.0")

    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test:runner:1.5.2")
}
