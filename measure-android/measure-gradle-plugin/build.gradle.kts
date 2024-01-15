plugins {
    id("org.jetbrains.kotlin.jvm") version "1.9.20"
    id("com.gradle.plugin-publish") version "1.2.0"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.20"
    id("sh.measure.plugin.aar2jar")
}

group = "sh.measure.plugin"
version = "0.0.1"

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
    compileOnly("com.android.tools.build:gradle:8.2.1")
    compileOnly("org.ow2.asm:asm-util:9.6")
    compileOnly("org.ow2.asm:asm-commons:9.6")

    implementation(gradleApi())
    implementation(platform("com.squareup.okhttp3:okhttp-bom:4.11.0"))
    implementation("com.squareup.okhttp3:okhttp")
    implementation("com.squareup.okhttp3:logging-interceptor")
    implementation("com.squareup.okio:okio:3.3.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.5.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.ow2.asm:asm-util:9.6")
    testImplementation("org.ow2.asm:asm-commons:9.6")
    testImplementation("com.android.tools.build:gradle:7.4.1")
    testImplementation("org.ow2.asm:asm-util:9.6")
    testImplementation("org.ow2.asm:asm-commons:9.6")
    testImplementation("com.nhaarman.mockitokotlin2:mockito-kotlin:2.2.0")
    testImplementationAar("sh.measure:android:0.0.1-SNAPSHOT")
}
