package sh.measure

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.internal.project.ProjectInternal
import org.gradle.api.services.BuildServiceRegistry
import org.gradle.internal.impldep.org.junit.rules.TemporaryFolder
import org.gradle.testfixtures.ProjectBuilder
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import java.time.Duration

class UploadProguardMappingTaskTest {
    private val temporaryFolder = TemporaryFolder()
    private lateinit var project: Project
    private lateinit var task: UploadProguardMappingTask
    private lateinit var mockWebServer: MockWebServer
    private val retriesCount = 2

    @Before
    fun setup() {
        temporaryFolder.create()
        mockWebServer = MockWebServer().apply { start() }
        project = ProjectBuilder.builder().withProjectDir(temporaryFolder.root).build()
        task = project.tasks.create("task", UploadProguardMappingTask::class.java)
        val manifestDataFile = temporaryFolder.newFile("manifestData.json").apply {
            writeText(manifestData)
        }
        val mappingFile = temporaryFolder.newFile("mapping.txt").apply {
            writeText("mapping file")
        }
        val buildServiceRegistry =
            (project as ProjectInternal).services.get(BuildServiceRegistry::class.java)
        val httpClient = buildServiceRegistry.registerIfAbsent(
            "measureHttpClient", MeasureHttpClient::class.java
        ) {
            it.parameters.timeout.set(Duration.ofSeconds(30))
        }.get()
        task.retriesProperty.set(retriesCount)
        task.httpClientProvider.set(httpClient)
        task.manifestDataProperty.set(manifestDataFile)
        task.mappingFileProperty.set(mappingFile)
        task.mappingEndpointProperty.set(mockWebServer.url("/upload").toString())
    }

    @After
    fun tearDown() {
        temporaryFolder.delete()
        mockWebServer.shutdown()
    }

    @Test
    fun `UploadProguardMappingTask sends request to upload mapping file`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        assertEquals("PUT", recordedRequest.method)
    }

    @Test
    fun `UploadProguardMappingTask retries the request and fails`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(500))
        mockWebServer.enqueue(MockResponse().setResponseCode(500))
        mockWebServer.enqueue(MockResponse().setResponseCode(500))
        assertThrows(GradleException::class.java) {
            task.upload()
        }
        assertEquals(retriesCount + 1, mockWebServer.requestCount)
    }

    @Test
    fun `UploadProguardMappingTask retries the request and succeeds`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(500))
        mockWebServer.enqueue(MockResponse().setResponseCode(500))
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        task.upload()
        assertEquals(retriesCount + 1, mockWebServer.requestCount)
    }

    @Test
    fun `UploadProguardMappingTask throws when response is 401`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(401))
        assertThrows(GradleException::class.java) {
            task.upload()
        }
    }

    private val manifestData = """
            {"apiKey":"api-key","versionCode":"100","appUniqueId":"sh.measure.sample","versionName":"1.0.0"}
        """.trimIndent()
}