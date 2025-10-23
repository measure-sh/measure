package sh.measure.fixtures

import com.autonomousapps.kit.AbstractGradleProject
import com.autonomousapps.kit.GradleProject
import com.autonomousapps.kit.android.AndroidManifest
import com.autonomousapps.kit.android.AndroidSubproject
import com.autonomousapps.kit.gradle.BuildScript
import com.autonomousapps.kit.gradle.BuildscriptBlock
import com.autonomousapps.kit.gradle.Dependencies
import com.autonomousapps.kit.gradle.Dependency
import com.autonomousapps.kit.gradle.GradleProperties
import com.autonomousapps.kit.gradle.Repositories
import com.autonomousapps.kit.gradle.Repository
import com.autonomousapps.kit.gradle.android.AndroidBlock
import com.autonomousapps.kit.gradle.android.DefaultConfig
import net.swiftzer.semver.SemVer
import sh.measure.Plugins

class MeasurePluginFixture(
    private val agpVersion: SemVer,
    private val minifyEnabled: Boolean = true,
    private val setMeasureApiKey: Boolean = true,
    private val setMeasureApiUrl: Boolean = true,
    private val measureApiUrl: String = "https://measure.sh",
    private val enabled: Boolean = true,
) : AbstractGradleProject() {

    val gradleProject: GradleProject = build()

    private fun build(): GradleProject {
        return newGradleProjectBuilder().configureRootProject().configureAndroidSubProject("app")
            .write()
    }

    private fun GradleProject.Builder.configureRootProject(): GradleProject.Builder {
        return withRootProject {
            gradleProperties += GradleProperties.minimalAndroidProperties()
            withBuildScript {
                buildscript = BuildscriptBlock(
                    repositories = Repositories(
                        Repository.MAVEN_CENTRAL,
                        Repository.GOOGLE,
                        Repository.MAVEN_LOCAL,
                    ),
                    dependencies = Dependencies(
                        Dependency.androidPlugin(agpVersion.toString()),
                    ),
                )
            }
        }
    }

    private fun AndroidBlock.Companion.defaultAndroidBlock(name: String): AndroidBlock {
        return AndroidBlock(
            namespace = "com.example.$name",
            compileSdkVersion = computeCompileSdkVersion(agpVersion),
            defaultConfig = DefaultConfig(
                applicationId = "com.example",
                minSdkVersion = 23,
                targetSdkVersion = 35,
                versionCode = 1,
                versionName = "1.0",
            ),
        )
    }

    // Ref: https://developer.android.com/build/releases/gradle-plugin#api-level-support
    private fun computeCompileSdkVersion(agpVersion: SemVer): Int {
        return when {
            agpVersion >= SemVer(8, 4, 0) -> 35
            agpVersion >= SemVer(8, 1, 1) -> 34
            else -> 33
        }
    }

    private fun BuildScript.Builder.withVariant(variant: Variant) {
        withGroovy(
            """\
                androidComponents {
                    beforeVariants(selector().withBuildType("${variant.buildType}")) {
                    minifyEnabled = ${variant.minifyEnabled}
                }
                }""",
        )
    }

    private fun GradleProject.Builder.configureAndroidSubProject(
        name: String,
    ): GradleProject.Builder {
        return withAndroidSubproject(name) {
            withBuildScript {
                plugins.add(Plugins.androidApp)
                plugins.add(Plugins.measurePlugin)
                android = AndroidBlock.defaultAndroidBlock(name)
                withVariant(
                    Variant(buildType = "release", minifyEnabled = minifyEnabled),
                )
                withAndroidManifest(setMeasureApiKey, setMeasureApiUrl)

                withGroovy(
                    """
                        measure {
                            variantFilter {
                               enabled = $enabled
                            }
                        }
                    """.trimIndent(),
                )
            }
        }
    }

    private fun AndroidSubproject.Builder.withAndroidManifest(
        setApiKey: Boolean,
        setApiUrl: Boolean,
    ) {
        val apiKeyMetaData = if (setApiKey) {
            """
            <meta-data 
                android:name="sh.measure.android.API_KEY" 
                android:value="msrsh_1234567890"/>
            """.trimIndent()
        } else {
            ""
        }
        val apiUrlMetaData = if (setApiUrl) {
            """
            <meta-data 
                android:name="sh.measure.android.API_URL" 
                android:value="$measureApiUrl"/>
            """.trimIndent()
        } else {
            ""
        }
        manifest = AndroidManifest(
            """<?xml version="1.0" encoding="utf-8"?>
            <manifest xmlns:android="http://schemas.android.com/apk/res/android">
                <application>
                    $apiKeyMetaData
                    $apiUrlMetaData
                </application>
            </manifest>
            """.trimIndent(),
        )
    }
}
