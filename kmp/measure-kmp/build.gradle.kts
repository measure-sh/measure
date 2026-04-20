import com.vanniktech.maven.publish.JavadocJar
import com.vanniktech.maven.publish.KotlinMultiplatform
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("multiplatform") version "2.3.20"
    id("com.android.kotlin.multiplatform.library") version "8.13.0"
    id("com.vanniktech.maven.publish") version "0.34.0"
    id("co.touchlab.kmmbridge.github") version "1.2.1"
}

private val measureKmpGroup = property("GROUP") as String
private val measureKmpVersion = property("MEASURE_KMP_VERSION_NAME") as String
private val measureAndroidVersion = property("MEASURE_ANDROID_VERSION") as String

group = measureKmpGroup
version = measureKmpVersion

// The Measure.xcframework consumed by cinterop is produced by Scripts/build-xcframework.sh,
// not by Gradle. The script is invoked from Xcode's Run Script build phase (for Frank) and
// from CI workflows before any Gradle invocation that needs the xcframework. Building it
// outside Gradle avoids nested xcodebuild contention with the parent Xcode XCBBuildService.
val xcfDir = layout.buildDirectory.dir("xcframework")

kotlin {
    androidLibrary {
        namespace = "sh.measure.kmp"
        compileSdk = 36
        minSdk = 21
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    listOf(iosX64(), iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "MeasureKMP"
            isStatic = true
            binaryOption("bundleId", "sh.measure.kmp")
        }
        target.compilations.getByName("main").cinterops.create("Measure") {
            defFile(project.file("src/appleMain/cinterop/Measure.def"))
            val slice = if (target.name == "iosArm64") "ios-arm64" else "ios-arm64_x86_64-simulator"
            val frameworkPath = "${xcfDir.get().asFile}/Measure.xcframework/$slice"
            extraOpts("-compiler-option", "-fmodules")
            extraOpts("-compiler-option", "-F$frameworkPath")
        }
    }

    sourceSets {
        androidMain.dependencies {
            api("sh.measure:measure-android:$measureAndroidVersion")
        }
    }
}

mavenPublishing {
    publishToMavenCentral(automaticRelease = true)
    signAllPublications()

    configure(
        KotlinMultiplatform(
            javadocJar = JavadocJar.Empty(),
            sourcesJar = true,
        ),
    )

    pom {
        name.set("Measure Kotlin Multiplatform SDK")
        description.set("Measure Kotlin Multiplatform SDK")
        inceptionYear.set("2025")
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

kmmbridge {
    gitHubReleaseArtifacts()
    spm(
        spmDirectory = layout.buildDirectory.dir("measure-kmp-spm").get().asFile.absolutePath,
        swiftToolVersion = "5.7",
    ) {
        iOS { v("12") }
    }
}
