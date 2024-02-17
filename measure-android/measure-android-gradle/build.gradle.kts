plugins {
    id("org.jetbrains.kotlin.jvm") version "1.9.21"
    id("com.gradle.plugin-publish") version "1.2.0"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.21"
    id("sh.measure.plugin.aar2jar")
    id("java-gradle-plugin")
    id("com.autonomousapps.testkit") version "0.8"
    id("com.diffplug.spotless") version "6.24.0"
    id("maven-publish")
}

group = properties["GROUP"] as String
version = properties["MEASURE_PLUGIN_VERSION_NAME"] as String

gradlePlugin {
    plugins {
        create("plugin") {
            id = "sh.measure.android.gradle"
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

val measureGradlePluginVersion = properties["MEASURE_PLUGIN_VERSION_NAME"] as String


publishing {
    publications {
        create<MavenPublication>("maven") {
            groupId = properties["GROUP"] as String
            artifactId = properties["MEASURE_PLUGIN_ARTIFACT_ID"] as String
            version = measureGradlePluginVersion

            from(components["java"])
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

dependencies {
    compileOnly(libs.agp)
    compileOnly(libs.asm.util)
    compileOnly(libs.asm.commons)

    implementation(gradleApi())
    implementation(libs.squareup.okhttp)
    implementation(libs.squareup.okhttp.logging)
    implementation(libs.squareup.okio)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit)

    testImplementation(libs.squareup.okhttp.mockwebserver)
    testImplementation(libs.asm.util)
    testImplementation(libs.asm.commons)
    testImplementation(libs.agp) // was 7.4.1
    testImplementation(libs.mockitokotlin2.mockito.kotlin)
    testImplementationAar(libs.measure.android)

    functionalTestRuntimeOnly("org.junit.platform:junit-platform-launcher")
    functionalTestImplementation(libs.junit.jupiter)
    functionalTestImplementation(libs.gradle.testkit.support)
    functionalTestImplementation(libs.gradle.testkit.truth)
    functionalTestImplementation(libs.squareup.okhttp.mockwebserver)
    functionalTestImplementation(libs.semver)
}

tasks.withType<Test>().configureEach {
    if (this.name.equals("functionalTest")) {
        useJUnitPlatform()
    }
}