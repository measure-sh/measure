package sh.measure

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.gradle.api.Project
import org.gradle.api.internal.project.ProjectInternal
import org.gradle.api.services.BuildServiceRegistry
import org.gradle.internal.impldep.org.junit.Rule
import org.gradle.internal.impldep.org.junit.rules.TemporaryFolder
import org.gradle.testfixtures.ProjectBuilder
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.time.Duration

class BuildUploadTaskTest {

    @field:Rule
    val temporaryFolder = TemporaryFolder()
    private lateinit var project: Project
    private lateinit var task: BuildUploadTask
    private lateinit var mockWebServer: MockWebServer
    private val retriesCount = 2
    private val customHeaders = mapOf(
        "Content-Type" to "CustomTypeValue",
        "msr-req-id" to "requestId",
        "customHeader" to "customHeaderValue"
    )
    private val disallowedCustomHeaders =
        setOf("Content-Type", "msr-req-id", "Authorization", "Content-Length")
    private val allowedCustomHeaders = customHeaders.keys.minus(disallowedCustomHeaders)

    @Before
    fun setup() {
        temporaryFolder.create()
        mockWebServer = MockWebServer().apply { start() }
        project = ProjectBuilder.builder().withProjectDir(temporaryFolder.root).build()
        task = project.tasks.create("task", BuildUploadTask::class.java)
        val url = mockWebServer.url("/builds").toString()
        val manifestDataFile = temporaryFolder.newFile("manifestData.json").apply {
            writeText(manifestData(url))
        }
        val mappingFile = temporaryFolder.newFile("mapping.txt").apply {
            writeText("mapping file")
        }
        val appSizeFile = temporaryFolder.newFile("appSize.txt").apply {
            writeText(appSize)
        }
        // Create an empty directory for Flutter symbols
        val flutterSymbolsDir = temporaryFolder.newFolder("flutter_symbols")
        
        val buildServiceRegistry =
            (project as ProjectInternal).services.get(BuildServiceRegistry::class.java)
        val httpClient = buildServiceRegistry.registerIfAbsent(
            "measureHttpClient",
            MeasureHttpClient::class.java,
        ) {
            it.parameters.timeout.set(Duration.ofSeconds(30))
        }.get()
        task.retriesProperty.set(retriesCount)
        task.httpClientProvider.set(httpClient)
        task.manifestDataProperty.set(manifestDataFile)
        task.mappingFileProperty.set(mappingFile)
        task.appSizeFileProperty.set(appSizeFile)
        task.flutterSymbolsDirProperty.set(project.file(flutterSymbolsDir))
        task.requestHeadersProperty.set(customHeaders)
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `BuildUploadTaskTest sends request to upload mapping file`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        assertEquals("PUT", recordedRequest.method)
        val requestBody = recordedRequest.body.readUtf8()
        val requestHeaders = recordedRequest.headers

        // println(requestBody)

        assertTrue(requestBody.contains("name=\"app_unique_id\""))
        assertTrue(requestBody.contains("sh.measure.sample"))
        assertTrue(requestBody.contains("name=\"version_code\""))
        assertTrue(requestBody.contains("7575527"))
        assertTrue(requestBody.contains("name=\"version_name\""))
        assertTrue(requestBody.contains("1.23.12"))
        assertTrue(requestBody.contains("name=\"build_size\""))
        assertTrue(requestBody.contains("123765"))
        assertTrue(requestBody.contains("name=\"build_type\""))
        assertTrue(requestBody.contains("aab"))
        assertTrue(requestBody.contains("name=\"mapping_type\""))
        assertTrue(requestBody.contains("proguard"))
        assertTrue(requestBody.contains("name=\"os_name\""))
        assertTrue(requestBody.contains("android"))
        assertTrue(
            requestHeaders.names().containsAll(allowedCustomHeaders)
        )
        assertTrue(requestHeaders.names().none { it in disallowedCustomHeaders })

    }
    
    @Test
    fun `BuildUploadTaskTest sends request with Flutter symbols when available`() {
        // Create a Flutter symbols file in the Flutter symbols directory
        val flutterSymbolsDir = temporaryFolder.root.resolve("flutter_symbols")
        val symbolsFile = File(flutterSymbolsDir, "app.android-arm64.symbols")
        symbolsFile.writeText("flutter symbols data")
        
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        assertEquals("PUT", recordedRequest.method)
        val requestBody = recordedRequest.body.readUtf8()
        
        // Verify basic request parts
        assertTrue(requestBody.contains("name=\"app_unique_id\""))
        assertTrue(requestBody.contains("sh.measure.sample"))
        
        // Verify Flutter symbols are included
        assertTrue(requestBody.contains("name=\"mapping_type\""))
        assertTrue(requestBody.contains("flutter_symbols"))
        assertTrue(requestBody.contains("app.android-arm64.symbols"))
        assertTrue(requestBody.contains("flutter symbols data"))
    }

    private val appSize = """
        123765
        aab
    """.trimIndent()

    private fun manifestData(url: String): String {
        return """
            {"apiKey":"api-key","apiUrl":"$url","versionCode":"7575527","appUniqueId":"sh.measure.sample","versionName":"1.23.12"}
        """.trimIndent()
    }
}
