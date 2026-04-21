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

val iosSdkDir = rootProject.file("../../ios")
val xcfDir = layout.buildDirectory.dir("xcframework")

val archiveMeasureIos = tasks.register<Exec>("archiveMeasureIos") {
    workingDir(iosSdkDir)
    inputs.files(fileTree(iosSdkDir.resolve("Sources")))
    outputs.dir(xcfDir.map { it.dir("Measure-ios.xcarchive") })
    commandLine(
        "xcodebuild", "archive",
        "-workspace", "Measure.xcworkspace",
        "-scheme", "Measure",
        "-destination", "generic/platform=iOS",
        "-archivePath", xcfDir.get().dir("Measure-ios.xcarchive").asFile.absolutePath,
        "SKIP_INSTALL=NO",
        "BUILD_LIBRARY_FOR_DISTRIBUTION=YES",
    )
}

val archiveMeasureIosSimulator = tasks.register<Exec>("archiveMeasureIosSimulator") {
    workingDir(iosSdkDir)
    inputs.files(fileTree(iosSdkDir.resolve("Sources")))
    outputs.dir(xcfDir.map { it.dir("Measure-sim.xcarchive") })
    commandLine(
        "xcodebuild", "archive",
        "-workspace", "Measure.xcworkspace",
        "-scheme", "Measure",
        "-destination", "generic/platform=iOS Simulator",
        "-archivePath", xcfDir.get().dir("Measure-sim.xcarchive").asFile.absolutePath,
        "SKIP_INSTALL=NO",
        "BUILD_LIBRARY_FOR_DISTRIBUTION=YES",
    )
}

val buildMeasureXCFramework = tasks.register<Exec>("buildMeasureXCFramework") {
    dependsOn(archiveMeasureIos, archiveMeasureIosSimulator)
    inputs.dir(xcfDir.map { it.dir("Measure-ios.xcarchive") })
    inputs.dir(xcfDir.map { it.dir("Measure-sim.xcarchive") })
    val output = xcfDir.map { it.dir("Measure.xcframework") }
    outputs.dir(output)
    doFirst { output.get().asFile.deleteRecursively() }
    commandLine(
        "xcodebuild", "-create-xcframework",
        "-framework", "${xcfDir.get().asFile}/Measure-ios.xcarchive/Products/Library/Frameworks/Measure.framework",
        "-framework", "${xcfDir.get().asFile}/Measure-sim.xcarchive/Products/Library/Frameworks/Measure.framework",
        "-output", output.get().asFile.absolutePath,
    )
}

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

tasks.matching { it.name.startsWith("cinteropMeasure") }.configureEach {
    dependsOn(buildMeasureXCFramework)
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
