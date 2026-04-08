plugins {
    kotlin("multiplatform") version "2.1.20"
}

group = "sh.measure"
version = "0.1.0"

kotlin {
    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64(),
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "MeasureKMP"
            isStatic = true
        }
    }

    sourceSets {
        appleMain.dependencies {
        }
    }
}
