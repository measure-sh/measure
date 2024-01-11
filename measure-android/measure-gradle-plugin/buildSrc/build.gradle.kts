plugins {
    `kotlin-dsl`
    id("java-gradle-plugin")
    id("org.jetbrains.kotlin.jvm") version "1.8.0"
}

repositories {
    mavenCentral()
}

dependencies {
    gradleApi()
}

gradlePlugin {
    plugins {
        register("sh.measure.plugin.aar2jar") {
            id = "sh.measure.plugin.aar2jar"
            implementationClass = "sh.measure.plugin.gradle.Aar2Jar"
        }
    }
}