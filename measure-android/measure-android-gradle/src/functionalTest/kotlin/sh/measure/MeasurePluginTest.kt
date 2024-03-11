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
    fun `minification enabled, assert upload proguard task present`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        val project = MeasurePluginFixture(agpVersion, minifyEnabled = true).gradleProject
        val result = build(gradleVersion, project.rootDir, ":app:assembleRelease")
        assertThat(result).task(":app:uploadReleaseProguardMappingToMeasure").isNotNull()
    }

    @ParameterizedTest
    @MethodSource("versions")
    fun `minification disabled, assert upload proguard task absent`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        val project = MeasurePluginFixture(agpVersion, minifyEnabled = false).gradleProject
        val result = build(gradleVersion, project.rootDir, ":app:assembleRelease")
        assertThat(result).doesNotHaveTask(":app:uploadReleaseProguardMappingToMeasure")
    }

    @ParameterizedTest
    @MethodSource("versions")
    fun `API_KEY is set in manifest, assert upload succeeds`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        server.enqueue(MockResponse().setResponseCode(200))
        server.start(8080)
        val project = MeasurePluginFixture(agpVersion, setMeasureApiKey = true).gradleProject
        val result = build(gradleVersion, project.rootDir, ":app:assembleRelease")
        assertThat(result).task(":app:assembleRelease").succeeded()
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

    @ParameterizedTest
    @MethodSource("versions")
    fun `API_KEY is set in manifest, assert upload fails after retries`(
        agpVersion: SemVer, gradleVersion: GradleVersion
    ) {
        // TODO(abhay): assuming 3 retries, this needs to be updated when retries are configurable.
        server.enqueue(MockResponse().setResponseCode(500))
        server.enqueue(MockResponse().setResponseCode(500))
        server.enqueue(MockResponse().setResponseCode(500))
        server.enqueue(MockResponse().setResponseCode(500))
        server.start(8080)
        val project = MeasurePluginFixture(agpVersion, setMeasureApiKey = true).gradleProject
        val result = build(gradleVersion, project.rootDir, ":app:assembleRelease")
        assertThat(result).output().contains("Failed to upload mapping file to Measure, the server encountered an error")
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

    companion object {
        @JvmStatic
        fun versions(): Stream<Arguments> {
            return Stream.of(
                Arguments.of(SemVer(7, 4, 1), GradleVersion.version("7.5")),
                Arguments.of(SemVer(8, 0, 2), GradleVersion.version("8.0")),
                Arguments.of(SemVer(8, 2, 1), GradleVersion.version("8.2"))
            )
        }
    }
}
