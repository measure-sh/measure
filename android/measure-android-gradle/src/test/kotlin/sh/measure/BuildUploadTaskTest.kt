package sh.measure

import kotlinx.serialization.json.Json
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
import org.junit.Assert.assertFalse
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
        "msr-req-id" to "requestId",
        "customHeader" to "customHeaderValue"
    )
    private val disallowedCustomHeader = "msr-req-id"
    private val allowedCustomHeaders = customHeaders.keys.minus(disallowedCustomHeader)

    @Suppress("NewApi")
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
        task.manifestFileProperty.set(manifestDataFile)
        task.mappingFileProperty.set(mappingFile)
        task.buildMetadataFileProperty.set(appSizeFile)
        task.flutterSymbolsDirProperty.set(project.file(flutterSymbolsDir))
        task.requestHeadersProperty.set(customHeaders)
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `sends request to upload mapping file`() {
        mockWebServer.enqueue(
            MockResponse().setResponseCode(200).setBody("""{"ok": "uploaded build info"}""")
        )
        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        assertEquals("PUT", recordedRequest.method)
        assertTrue(recordedRequest.headers["Content-Type"]?.startsWith("application/json") == true)

        val requestBody = recordedRequest.body.readUtf8()
        val buildsRequest = Json.decodeFromString(BuildsApiRequest.serializer(), requestBody)
        val requestHeaders = recordedRequest.headers

        assertEquals("7575527", buildsRequest.version_code)
        assertEquals("1.23.12", buildsRequest.version_name)
        assertEquals(123765L, buildsRequest.build_size)
        assertEquals("aab", buildsRequest.build_type)
        assertEquals(1, buildsRequest.mappings.size)
        assertEquals("proguard", buildsRequest.mappings[0].type)
        assertEquals("mapping.txt", buildsRequest.mappings[0].filename)

        assertTrue(
            requestHeaders.names().containsAll(allowedCustomHeaders)
        )
        assertTrue(requestHeaders.names().none { it in disallowedCustomHeader })
    }

    @Test
    fun `sends request with Flutter symbols when available`() {
        // Create a Flutter symbols file in the Flutter symbols directory
        val flutterSymbolsDir = temporaryFolder.root.resolve("flutter_symbols")
        val symbolsFile = File(flutterSymbolsDir, "app.android-arm64.symbols")
        symbolsFile.writeText("flutter symbols data")

        mockWebServer.enqueue(
            MockResponse().setResponseCode(200).setBody("""{"ok": "uploaded build info"}""")
        )
        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        assertEquals("PUT", recordedRequest.method)
        assertTrue(recordedRequest.headers["Content-Type"]?.startsWith("application/json") == true)

        val requestBody = recordedRequest.body.readUtf8()
        val buildsRequest = Json.decodeFromString(BuildsApiRequest.serializer(), requestBody)

        // Verify basic request parts
        assertEquals("7575527", buildsRequest.version_code)
        assertEquals("1.23.12", buildsRequest.version_name)

        // Verify Flutter symbols are included (should have both proguard and flutter symbols)
        assertEquals(2, buildsRequest.mappings.size)
        assertTrue(buildsRequest.mappings.any { it.type == "proguard" && it.filename == "mapping.txt" })
        assertTrue(buildsRequest.mappings.any { it.type == "elf_debug" && it.filename == "app.android-arm64.symbols" })
    }

    @Test
    fun `sends request with API_KEY in the header`() {
        mockWebServer.enqueue(
            MockResponse().setResponseCode(200).setBody("""{"ok": "uploaded build info"}""")
        )
        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        val requestHeaders = recordedRequest.headers
        assertTrue(requestHeaders.names().contains(HEADER_AUTHORIZATION))
        assertTrue(requestHeaders.values(HEADER_AUTHORIZATION).contains("Bearer msrsh_123"))
    }

    @Test
    fun `sends request with custom headers`() {
        mockWebServer.enqueue(
            MockResponse().setResponseCode(200).setBody("""{"ok": "uploaded build info"}""")
        )
        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        val requestHeaders = recordedRequest.headers
        assertTrue(requestHeaders.names().containsAll(allowedCustomHeaders))
    }

    @Test
    fun `disallowed custom headers are filtered`() {
        mockWebServer.enqueue(
            MockResponse().setResponseCode(200).setBody("""{"ok": "uploaded build info"}""")
        )
        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        val requestHeaders = recordedRequest.headers
        assertFalse(requestHeaders.names().contains("msr-req-id"))
    }

    @Test
    fun `sends JSON request to builds endpoint`() {
        mockWebServer.enqueue(
            MockResponse().setResponseCode(200).setBody("""{"ok": "uploaded build info"}""")
        )
        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        assertEquals("PUT", recordedRequest.method)
        assertTrue(recordedRequest.headers["Content-Type"]?.startsWith("application/json") == true)

        val requestBody = recordedRequest.body.readUtf8()
        val buildsRequest = Json.decodeFromString(BuildsApiRequest.serializer(), requestBody)

        assertEquals("7575527", buildsRequest.version_code)
        assertEquals("1.23.12", buildsRequest.version_name)
        assertEquals(123765L, buildsRequest.build_size)
        assertEquals("aab", buildsRequest.build_type)
        assertEquals(1, buildsRequest.mappings.size)
        assertEquals("proguard", buildsRequest.mappings[0].type)
        assertEquals("mapping.txt", buildsRequest.mappings[0].filename)
    }

    @Test
    fun `handles builds response with presigned URLs`() {
        val uploadUrl = mockWebServer.url("/upload-mapping").toString()
        val buildsResponse = """
            {
                "mappings": [
                    {
                        "id": "test-id-1",
                        "type": "proguard",
                        "filename": "mapping.txt",
                        "upload_url": "$uploadUrl",
                        "expires_at": "2025-08-13T01:59:45.577889184Z",
                        "headers": {
                            "x-amz-meta-mapping_id": "test-id-1",
                            "x-amz-meta-original_file_name": "mapping.txt"
                        }
                    }
                ]
            }
        """.trimIndent()

        // Enqueue response for builds API call
        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody(buildsResponse))
        // Enqueue response for file upload to pre-signed URL
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        task.upload()

        // Verify builds API call
        val buildsRequest = mockWebServer.takeRequest()
        assertEquals("PUT", buildsRequest.method)
        assertEquals("/builds", buildsRequest.path)

        // Verify file upload request
        val uploadRequest = mockWebServer.takeRequest()
        assertEquals("PUT", uploadRequest.method)
        assertEquals("/upload-mapping", uploadRequest.path)
        assertTrue(uploadRequest.headers.names().contains("x-amz-meta-mapping_id"))
        assertEquals("test-id-1", uploadRequest.headers["x-amz-meta-mapping_id"])
        assertTrue(uploadRequest.headers.names().contains("x-amz-meta-original_file_name"))
        assertEquals("mapping.txt", uploadRequest.headers["x-amz-meta-original_file_name"])

        // Verify the file content was uploaded
        val uploadedContent = uploadRequest.body.readUtf8()
        assertEquals("mapping file", uploadedContent)
    }

    @Test
    fun `handles builds response without mappings`() {
        mockWebServer.enqueue(
            MockResponse().setResponseCode(200).setBody("""{"ok": "uploaded build info"}""")
        )

        // Clear mapping file to test no-mappings scenario
        val file: File? = null
        task.mappingFileProperty.set(file)

        task.upload()
        val recordedRequest = mockWebServer.takeRequest()
        assertEquals("PUT", recordedRequest.method)

        val requestBody = recordedRequest.body.readUtf8()
        val buildsRequest = Json.decodeFromString(BuildsApiRequest.serializer(), requestBody)
        assertEquals(0, buildsRequest.mappings.size)
    }

    @Test
    fun `retries on server error and succeeds on second attempt`() {
        // First request fails with 500, second request succeeds
        mockWebServer.enqueue(MockResponse().setResponseCode(500))
        mockWebServer.enqueue(
            MockResponse().setResponseCode(200).setBody("""{"ok": "uploaded build info"}""")
        )

        task.upload()

        // Verify both requests were made
        assertEquals(2, mockWebServer.requestCount)

        // Verify first request
        val firstRequest = mockWebServer.takeRequest()
        assertEquals("PUT", firstRequest.method)
        assertEquals("/builds", firstRequest.path)

        // Verify retry request
        val retryRequest = mockWebServer.takeRequest()
        assertEquals("PUT", retryRequest.method)
        assertEquals("/builds", retryRequest.path)
    }

    @Test
    fun `retries multiple times before giving up`() {
        val maxRetries = 2
        task.retriesProperty.set(maxRetries)

        // All requests fail with 500
        repeat(maxRetries + 1) {
            mockWebServer.enqueue(MockResponse().setResponseCode(500))
        }

        task.upload()

        // Verify all retry attempts were made
        assertEquals(maxRetries + 1, mockWebServer.requestCount)

        // Verify all requests were to builds endpoint
        repeat(maxRetries + 1) {
            val request = mockWebServer.takeRequest()
            assertEquals("PUT", request.method)
            assertEquals("/builds", request.path)
        }
    }

    @Test
    fun `does not retry on client error 401`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(401))

        task.upload()

        // Should only make one request, no retries
        assertEquals(1, mockWebServer.requestCount)

        val request = mockWebServer.takeRequest()
        assertEquals("PUT", request.method)
        assertEquals("/builds", request.path)
    }

    @Test
    fun `retries file upload on server error`() {
        val uploadUrl = mockWebServer.url("/upload-mapping").toString()
        val buildsResponse = """
            {
                "mappings": [
                    {
                        "id": "test-id-1",
                        "type": "proguard",
                        "filename": "mapping.txt",
                        "upload_url": "$uploadUrl",
                        "expires_at": "2025-08-13T01:59:45.577889184Z",
                        "headers": {
                            "x-amz-meta-mapping_id": "test-id-1",
                            "x-amz-meta-original_file_name": "mapping.txt"
                        }
                    }
                ]
            }
        """.trimIndent()

        // Builds API succeeds
        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody(buildsResponse))
        // First file upload fails with 500
        mockWebServer.enqueue(MockResponse().setResponseCode(500))
        // Second file upload succeeds
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        task.upload()

        // Verify all requests were made
        assertEquals(3, mockWebServer.requestCount)

        // Skip builds request
        mockWebServer.takeRequest()

        // Verify first upload attempt
        val firstUpload = mockWebServer.takeRequest()
        assertEquals("PUT", firstUpload.method)
        assertEquals("/upload-mapping", firstUpload.path)

        // Verify retry upload attempt
        val retryUpload = mockWebServer.takeRequest()
        assertEquals("PUT", retryUpload.method)
        assertEquals("/upload-mapping", retryUpload.path)
    }

    private val appSize = """
        123765
        aab
    """.trimIndent()

    private fun manifestData(url: String): String {
        return """
            {"apiKey":"msrsh_123","apiUrl":"$url","versionCode":"7575527","appUniqueId":"sh.measure.sample","versionName":"1.23.12"}
        """.trimIndent()
    }
}
