val ktor_version: String by project
val kotlin_version: String by project
val logback_version: String by project

plugins {
    kotlin("jvm") version "1.9.10"
    id("io.ktor.plugin") version "2.3.5"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.10"
}

group = "sh.measure"
version = "0.0.1"

application {
    mainClass.set("sh.measure.ApplicationKt")
}

ktor {
    fatJar {
        archiveFileName.set("symbolicator-retrace.jar")
    }
}

repositories {
    mavenCentral()
    maven {
        url = uri("https://storage.googleapis.com/r8-releases/raw")
    }
}

dependencies {
    implementation("io.ktor:ktor-server-content-negotiation-jvm:2.2.4")
    implementation("io.ktor:ktor-server-request-validation:$ktor_version")
    implementation("io.ktor:ktor-server-status-pages:$ktor_version")
    implementation("io.ktor:ktor-server-core-jvm:2.2.4")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm:2.2.4")
    implementation("io.ktor:ktor-server-netty-jvm:2.2.4")
    implementation("ch.qos.logback:logback-classic:$logback_version")
    implementation("com.android.tools:r8:8.1.60")
    implementation("com.amazonaws:aws-java-sdk-s3:1.12.566")
    testImplementation("io.ktor:ktor-server-tests-jvm:2.2.4")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:$kotlin_version")
}
