@file:Suppress("FunctionName")

package sh.measure

import com.autonomousapps.kit.GradleBuilder.build
import com.autonomousapps.kit.GradleBuilder.buildAndFail
import com.autonomousapps.kit.truth.TestKitTruth.Companion.assertThat
import net.swiftzer.semver.SemVer
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.gradle.util.GradleVersion
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import sh.measure.fixtures.MeasurePluginFixture
import java.util.stream.Stream

class MeasurePluginTest {
    private lateinit var server: MockWebServer

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    @ParameterizedTest
    @MethodSource("versions")
    fun `assert tasks are created when assemble task is triggered`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        val project = MeasurePluginFixture(agpVersion, minifyEnabled = true).gradleProject
        val result = build(gradleVersion, project.rootDir, ":app:assembleRelease")
        assertThat(result).task(":app:extractReleaseManifestData").isNotNull()
        assertThat(result).task(":app:calculateApkSizeRelease").isNotNull()
        assertThat(result).task(":app:uploadReleaseBuildToMeasure").isNotNull()
    }

    @ParameterizedTest
    @MethodSource("versions")
    fun `assert tasks are created when bundle task is triggered`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        val project = MeasurePluginFixture(agpVersion, minifyEnabled = false).gradleProject
        val result = build(gradleVersion, project.rootDir, ":app:bundleRelease")
        assertThat(result).task(":app:extractReleaseManifestData").isNotNull()
        assertThat(result).task(":app:calculateAabSizeRelease").isNotNull()
        assertThat(result).task(":app:uploadReleaseBuildToMeasure").isNotNull()
    }

    @ParameterizedTest
    @MethodSource("versions")
    fun `assert tasks are not created when a task other than assemble or bundle are triggered`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        val project = MeasurePluginFixture(agpVersion, minifyEnabled = false).gradleProject
        val result = build(gradleVersion, project.rootDir, ":app:test")
        assertThat(result).doesNotHaveTask(":app:extractReleaseManifestData")
        assertThat(result).doesNotHaveTask(":app:calculateAabSizeRelease")
        assertThat(result).doesNotHaveTask(":app:uploadReleaseBuildToMeasure")
    }

    @ParameterizedTest
    @MethodSource("versions")
    fun `API_KEY is set in manifest, assert upload request is created`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        server.enqueue(MockResponse().setResponseCode(200))
        server.start(8080)
        val project = MeasurePluginFixture(agpVersion, setMeasureApiKey = true).gradleProject
        build(gradleVersion, project.rootDir, ":app:assembleRelease")
        assertEquals(1, server.requestCount)
    }

    @ParameterizedTest
    @MethodSource("versions")
    fun `API_KEY is not set in manifest, assert task fails`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        val project = MeasurePluginFixture(agpVersion, setMeasureApiKey = false).gradleProject
        val result = buildAndFail(gradleVersion, project.rootDir, ":app:assembleRelease")
        assertThat(result).output().contains("sh.measure.android.API_KEY not set in manifest")
    }

    @ParameterizedTest
    @MethodSource("versions")
    fun `assert plugin does not break configuration cache`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        server.enqueue(MockResponse().setResponseCode(200))
        server.enqueue(MockResponse().setResponseCode(200))
        server.start(8080)
        val project = MeasurePluginFixture(agpVersion).gradleProject

        // first build
        build(gradleVersion, project.rootDir, ":app:assembleRelease", "--configuration-cache")

        // second build
        val result =
            build(gradleVersion, project.rootDir, ":app:assembleRelease", "--configuration-cache")
        if (agpVersion > SemVer(8, 0)) {
            // AGP < 8 has a bug that prevents use of CC
            assertThat(result).output().contains("Configuration cache entry reused.")
        }
    }

    companion object {
        @JvmStatic
        fun versions(): Stream<Arguments> {
            return Stream.of(
                Arguments.of(SemVer(7, 4, 1), GradleVersion.version("7.5")),
                Arguments.of(SemVer(8, 0, 2), GradleVersion.version("8.0")),
                Arguments.of(SemVer(8, 2, 1), GradleVersion.version("8.2")),
                Arguments.of(SemVer(8, 3, 2), GradleVersion.version("8.5")),
                Arguments.of(SemVer(8, 4, 1), GradleVersion.version("8.6")),
            )
        }
    }
}
