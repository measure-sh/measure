plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.gradle.plugin.publish)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.autonomousapps.testkit)
    alias(libs.plugins.diffplug.spotless)
    id("sh.measure.plugin.aar2jar")
    id("java-gradle-plugin")
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
    testImplementation(libs.agp)
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