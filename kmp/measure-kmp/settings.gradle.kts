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

includeBuild("../../android") {
    name = "measure-android"
    dependencySubstitution {
        substitute(module("sh.measure:measure-android")).using(project(":measure"))
    }
}
