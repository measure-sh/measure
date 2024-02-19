enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    versionCatalogs {
        create("libs") {
            from(files("../gradle/libs.versions.toml"))
        }
    }
    repositories {
        google()
        mavenCentral()
        mavenLocal()
        maven {
            url = uri("https://maven.pkg.github.com/measure-sh/measure")
            credentials {
                username = extra.properties["gpr.user"] as String? ?: System.getenv("GITHUB_ACTOR")
                password = extra.properties["gpr.key"] as String? ?: System.getenv("GITHUB_TOKEN")
            }
        }
    }
}

rootProject.name = "measure-android-gradle"
