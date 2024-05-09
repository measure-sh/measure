pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
@Suppress("UnstableApiUsage")
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "measure-android"
include(":sample")
include(":measure")
includeBuild("measure-android-gradle")
include(":benchmarks:benchmark")
include(":benchmarks:app")
include(":measure-ndk")
