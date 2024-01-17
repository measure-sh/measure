plugins {
    id("org.jetbrains.kotlin.jvm") version "1.9.10"
    id("com.gradle.plugin-publish") version "1.2.0"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.10"
    id("sh.measure.plugin.aar2jar")
    id("java-gradle-plugin")
    id("com.autonomousapps.testkit") version "0.8"
    id("com.diffplug.spotless") version "6.24.0"
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
    jvmToolchain(17)
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

    functionalTestRuntimeOnly("org.junit.platform:junit-platform-launcher")
    functionalTestImplementation("org.junit.jupiter:junit-jupiter:5.9.2")
    functionalTestImplementation("com.autonomousapps:gradle-testkit-support:0.14")
    functionalTestImplementation("com.autonomousapps:gradle-testkit-truth:1.5")
    functionalTestImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    functionalTestImplementation("net.swiftzer.semver:semver:1.1.2")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}