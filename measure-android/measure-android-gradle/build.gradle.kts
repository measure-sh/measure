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
    compileOnly("com.android.tools.build:gradle:8.2.1")
    compileOnly("org.ow2.asm:asm-util:9.6")
    compileOnly("org.ow2.asm:asm-commons:9.6")

    implementation(gradleApi())
    implementation(platform("com.squareup.okhttp3:okhttp-bom:4.11.0"))
    implementation("com.squareup.okhttp3:okhttp")
    implementation("com.squareup.okhttp3:logging-interceptor")
    implementation("com.squareup.okio:okio:3.3.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.ow2.asm:asm-util:9.6")
    testImplementation("org.ow2.asm:asm-commons:9.6")
    testImplementation("com.android.tools.build:gradle:7.4.1")
    testImplementation("org.ow2.asm:asm-util:9.6")
    testImplementation("org.ow2.asm:asm-commons:9.6")
    testImplementation("com.nhaarman.mockitokotlin2:mockito-kotlin:2.2.0")
    testImplementationAar("sh.measure:measure-android:0.1.0")

    functionalTestRuntimeOnly("org.junit.platform:junit-platform-launcher")
    functionalTestImplementation("org.junit.jupiter:junit-jupiter:5.9.2")
    functionalTestImplementation("com.autonomousapps:gradle-testkit-support:0.14")
    functionalTestImplementation("com.autonomousapps:gradle-testkit-truth:1.5")
    functionalTestImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    functionalTestImplementation("net.swiftzer.semver:semver:1.1.2")
}

tasks.withType<Test>().configureEach {
    if  (this.name.equals("functionalTest")) {
        useJUnitPlatform()
    }
}