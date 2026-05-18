pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "measure-kmp"

includeBuild("../../android/measure-android") {
    dependencySubstitution {
        substitute(module("sh.measure:measure-android")).using(project(":measure"))
    }
}
