# Prepare the release

* Update the VERSION_NAME in `measure-android/gradle.properties` to release a new version of measure-android.
* Update the VERSION_NAME in `measure-android-gradle/gradle.properties` to release a new version of
  measure-android-gradle.
* Update the README.md with the new versions.

**Make sure all the changes are committed and pushed to the `main` branch.**

# Release Measure Android SDK

* [Create a new release on Github](https://github.com/measure-sh/measure/releases/new).
* Select the `main` branch.
* Enter the release title in the format `measure-android-<major>.<minor>.<patch>`.
* Use the same tag as the title.
* Enter the release description.
* Click the publish release button.

# Release Measure Android Gradle Plugin

* [Create a new release on Github](https://github.com/measure-sh/measure/releases/new).
* Select the `main` branch.
* Enter the release title in the format `measure-android-gradle-<major>.<minor>.<patch>`.
* Use the same tag as the title.
* Enter the release description.
* Click the publish release button.

Once the release is created, the Github Action will automatically publish the new version to Github packages.

# Verify

To verify the release, follow the steps below.

1. [Create a PAT (classic)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic)
   if you haven't already.
2. Add the following maven blocks to your `settings.gradle.kts` file.

```kotlin
pluginManagement {
    repositories {
        maven {
            url = uri("https://maven.pkg.github.com/measure-sh/measure")
            credentials {
                username = extra.properties["gpr.user"] as String
                password = extra.properties["gpr.key"] as String
            }
        }
    }
}

dependencyResolutionManagement {
    repositories {
        maven {
            url = uri("https://maven.pkg.github.com/measure-sh/measure")
            credentials {
                username = extra.properties["gpr.user"] as String
                password = extra.properties["gpr.key"] as String
            }
        }
    }
}
```

3. To add the Measure Android SDK dependency, add the following to your `build.gradle.kts` file.

```kotlin
dependencies {
    implementation("sh.measure:measure-android:<<latest-version>>")
}
```

4. To add the Measure Android Gradle Plugin dependency, add the following to your `build.gradle.kts` file.

```kotlin
plugins {
    id("sh.measure.android.gradle") version "<<latest-version>>"
}
```