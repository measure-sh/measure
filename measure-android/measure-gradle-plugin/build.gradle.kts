plugins {
    id("org.jetbrains.kotlin.jvm") version "1.8.0"
    id("com.gradle.plugin-publish") version "1.2.0"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.8.0"
}

group = "sh.measure.plugin"
version = "0.1.0"

gradlePlugin {
    plugins {
        create("plugin") {
            id = "sh.measure.plugin"
            displayName = "Measure Gradle Plugin"
            description = "A gradle plugin for Measure Android SDK"
            implementationClass = "sh.measure.MeasurePlugin"
        }
    }
}

kotlin {
    jvmToolchain(11)
}

java {
    withSourcesJar()
    withJavadocJar()
}

dependencies {
    compileOnly("com.android.tools.build:gradle:7.4.1")

    implementation(gradleApi())
    implementation(platform("com.squareup.okhttp3:okhttp-bom:4.11.0"))
    implementation("com.squareup.okhttp3:okhttp")
    implementation("com.squareup.okhttp3:logging-interceptor")
    implementation("com.squareup.okio:okio:3.3.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.5.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
