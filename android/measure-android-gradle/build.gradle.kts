import com.diffplug.gradle.spotless.SpotlessExtension
import com.vanniktech.maven.publish.GradlePublishPlugin

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.gradle.plugin.publish)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.autonomousapps.testkit)
    alias(libs.plugins.diffplug.spotless)
    id("sh.measure.plugin.aar2jar")
    id("java-gradle-plugin")
    alias(libs.plugins.mavenPublish)
}

@Suppress("UnstableApiUsage")
gradlePlugin {
    plugins {
        create("plugin") {
            id = "sh.measure.android.gradle"
            displayName = "Measure Gradle Plugin"
            description = "A gradle plugin for Measure Android SDK"
            implementationClass = "sh.measure.MeasurePlugin"
            website = "https://measure.sh"
            vcsUrl = "https://github.com/measure-sh/measure"
            tags = listOf("measure")
        }
    }
}

private val artifactId = properties["MEASURE_PLUGIN_ARTIFACT_ID"] as String
// The group and version are used by autonomousapps-testkit plugin. Changing the variable names
// will lead to functional tests breaking.
group = properties["MEASURE_PLUGIN_GROUP_ID"] as String
version = properties["MEASURE_PLUGIN_VERSION_NAME"] as String

mavenPublishing {
    coordinates(group as String, artifactId, version as String)
    publishToMavenCentral(automaticRelease = true)
    configure(
        GradlePublishPlugin(),
    )

    pom {
        name.set("Measure Android Gradle Plugin")
        description.set("Measure Android Gradle Plugin")
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

kotlin {
    jvmToolchain(11)
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
    compileOnly(libs.agp860)
    compileOnly(libs.asm.util)
    compileOnly(libs.asm.commons)

    implementation(gradleApi())
    implementation(libs.squareup.okhttp)
    implementation(libs.squareup.okhttp.logging)
    implementation(libs.squareup.okio)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.android.tools.bundletool)
    implementation(libs.android.tools.sdklib)
    implementation(libs.android.tools.common)
    implementation(libs.android.tools.apkanalyzer)

    testImplementation(libs.junit)

    testImplementation(libs.squareup.okhttp.mockwebserver)
    testImplementation(libs.asm.util)
    testImplementation(libs.asm.commons)
    testImplementation(libs.agp860)
    testImplementation(libs.mockitokotlin2.mockito.kotlin)
    testImplementationAar(libs.measure.android)

    functionalTestRuntimeOnly(libs.junit.platform.launcher)
    functionalTestImplementation(libs.junit.jupiter)
    functionalTestImplementation(libs.gradle.testkit.support)
    functionalTestImplementation(libs.gradle.testkit.truth)
    functionalTestImplementation(libs.squareup.okhttp.mockwebserver)
    functionalTestImplementation(libs.semver)
}

tasks.withType<Test>().configureEach {
    javaLauncher.set(javaToolchains.launcherFor {
        languageVersion.set(JavaLanguageVersion.of(17))
    })
    if (this.name == "functionalTest") {
        useJUnitPlatform()
    }
}
