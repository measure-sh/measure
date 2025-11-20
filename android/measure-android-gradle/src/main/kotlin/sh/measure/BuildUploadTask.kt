@file:Suppress("PropertyName")

package sh.measure

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromStream
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.MapProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.TaskAction
import java.io.File
import java.io.IOException
import java.net.URI
import java.net.URL

internal const val HEADER_AUTHORIZATION = "Authorization"
private const val TYPE_PROGUARD = "proguard"
private const val TYPE_FLUTTER_SYMBOLS = "elf_debug"
private const val BUILDS_PATH = "builds"

private const val ERROR_MSG_401 =
    "measure: Failed to upload build info to Measure, please check the api-key in manifest. Stack traces will not be symbolicated."
private const val ERROR_MSG_413 =
    "measure: Failed to upload build info to Measure, build size exceeded the maximum allowed limit. Stack traces will not be symbolicated."
private const val ERROR_MSG_500 =
    "measure: Failed to upload build info to Measure, the server encountered an error, try again later. Stack traces will not be symbolicated."

private val DISALLOWED_CUSTOM_HEADERS =
    setOf("Content-Type", "msr-req-id", "Authorization", "Content-Length")

@Suppress("UnsafeOptInUsageError")
@Serializable
internal data class MappingInfo(
    val type: String,
    val filename: String,
)

@Suppress("UnsafeOptInUsageError")
@Serializable
internal data class BuildsApiRequest(
    val version_name: String,
    val version_code: String,
    val build_size: Long,
    val build_type: String,
    val mappings: List<MappingInfo> = emptyList(),
)


@Suppress("UnsafeOptInUsageError")
@Serializable
internal data class MappingUpload(
    val id: String,
    val type: String,
    val filename: String,
    val upload_url: String,
    val expires_at: String,
    val headers: Map<String, String>,
)


@Suppress("UnsafeOptInUsageError")
@Serializable
internal data class BuildsApiResponse(
    val ok: String? = null,
    val mappings: List<MappingUpload> = emptyList(),
)

abstract class BuildUploadTask : DefaultTask() {
    init {
        group = MeasurePlugin.GROUP_NAME
        description = "Uploads mapping files to Measure for symbolication"
    }

    @get:Internal
    abstract val httpClientProvider: Property<MeasureHttpClient>

    @get:Optional
    @get:InputFile
    abstract val mappingFileProperty: RegularFileProperty

    @get:Optional
    @get:InputDirectory
    abstract val flutterSymbolsDirProperty: RegularFileProperty

    @get:InputFile
    abstract val manifestFileProperty: RegularFileProperty

    @get:InputFile
    abstract val buildMetadataFileProperty: RegularFileProperty

    @get:Input
    abstract val retriesProperty: Property<Int>

    @get:Input
    abstract val requestHeadersProperty: MapProperty<String, String>

    @TaskAction
    fun upload() {
        val manifestFile = manifestFileProperty.get().asFile
        val mappingFile = mappingFileProperty.getOrNull()?.asFile
        val buildMetadataFile = buildMetadataFileProperty.get().asFile
        val flutterSymbolsDir = flutterSymbolsDirProperty.getOrNull()?.asFile

        val manifestData = readManifestData(manifestFile)
        val (buildSize, buildType) = readBuildMetadata(buildMetadataFile)

        val client = httpClientProvider.get().client
        val mappings = collectMappingInfo(mappingFile, flutterSymbolsDir)
        val buildsRequest = createBuildsRequest(manifestData, buildSize, buildType, mappings)

        sendBuildsRequest(
            client,
            manifestData,
            buildsRequest,
            mappings,
            mappingFile,
            flutterSymbolsDir
        )
    }

    private fun collectMappingInfo(
        mappingFile: File?,
        flutterSymbolsDir: File?,
    ): List<MappingInfo> {
        val mappings = mutableListOf<MappingInfo>()

        if (mappingFile != null) {
            logger.info("measure: proguard mapping file found at ${mappingFile.absolutePath}")
            mappings.add(MappingInfo(type = TYPE_PROGUARD, filename = mappingFile.name))
        } else {
            logger.warn("measure: mapping file not found, symbolication will not work")
        }

        flutterSymbolsDir?.let { symbolsDir ->
            val symbolsFiles = symbolsDir.listFiles { file -> file.extension == "symbols" }
            logger.info("measure: ${symbolsFiles.size} flutter symbol files found at ${symbolsDir.absolutePath}")
            symbolsFiles?.forEach { symbolsFile ->
                mappings.add(MappingInfo(type = TYPE_FLUTTER_SYMBOLS, filename = symbolsFile.name))
            }
        }

        return mappings
    }

    private fun createBuildsRequest(
        manifestData: ManifestData,
        buildSize: Long,
        buildType: String,
        mappings: List<MappingInfo>,
    ): BuildsApiRequest {
        return BuildsApiRequest(
            version_name = manifestData.versionName,
            version_code = manifestData.versionCode,
            build_size = buildSize,
            build_type = buildType,
            mappings = mappings
        )
    }

    private fun sendBuildsRequest(
        client: okhttp3.OkHttpClient,
        manifestData: ManifestData,
        buildsRequest: BuildsApiRequest,
        mappings: List<MappingInfo>,
        mappingFile: File?,
        flutterSymbolsDir: File?,
    ) {
        val buildsResponse = callBuildsApi(client, manifestData, buildsRequest)
        if (buildsResponse != null && mappings.isNotEmpty()) {
            uploadMappingFiles(client, buildsResponse, mappingFile, flutterSymbolsDir)
        }
    }

    private fun callBuildsApi(
        client: okhttp3.OkHttpClient,
        manifestData: ManifestData,
        buildsRequest: BuildsApiRequest,
    ): BuildsApiResponse? {
        val url = URI.create(manifestData.apiUrl).resolve(BUILDS_PATH).toURL()
        val request = createBuildsApiRequest(url, manifestData, buildsRequest)

        return executeHttpRequestWithRetry(client, request, "Builds API request") { response ->
            if (response.isSuccessful) {
                Json.decodeFromString(BuildsApiResponse.serializer(), response.body!!.string())
            } else {
                logError(response)
                null
            }
        }
    }

    private fun createBuildsApiRequest(
        url: URL,
        manifestData: ManifestData,
        buildsRequest: BuildsApiRequest,
    ): Request {
        val jsonBody = Json.encodeToString(BuildsApiRequest.serializer(), buildsRequest)
            .toRequestBody("application/json".toMediaType())
        return createJsonRequest(url, manifestData, jsonBody)
    }

    private fun createJsonRequest(
        url: URL, manifestData: ManifestData, requestBody: RequestBody,
    ): Request {
        val requestBuilder = Request.Builder()
        requestBuilder.headers(sanitizedCustomHeaders())
        requestBuilder.url(url).header(HEADER_AUTHORIZATION, "Bearer ${manifestData.apiKey}")
        requestBuilder.put(requestBody)
        return requestBuilder.build()
    }

    private fun uploadMappingFiles(
        client: okhttp3.OkHttpClient,
        buildsResponse: BuildsApiResponse,
        mappingFile: File?,
        flutterSymbolsDir: File?,
    ) {
        buildsResponse.mappings.forEach { mapping ->
            val file = when (mapping.type) {
                TYPE_PROGUARD -> mappingFile
                TYPE_FLUTTER_SYMBOLS -> {
                    flutterSymbolsDir?.listFiles { f -> f.extension == "symbols" && f.name == mapping.filename }
                        ?.firstOrNull()
                }

                else -> null
            }

            if (file != null && file.exists()) {
                uploadFileToPresignedUrl(client, mapping, file)
            } else {
                logger.warn("measure: file ${mapping.filename} not found for upload")
            }
        }
    }

    private fun uploadFileToPresignedUrl(
        client: okhttp3.OkHttpClient,
        mapping: MappingUpload,
        file: File,
    ) {
        val request = createFileUploadRequest(mapping, file)
        val operationName = "Upload ${mapping.filename}"

        executeHttpRequestWithRetry(client, request, operationName) { response ->
            if (response.isSuccessful) {
                logger.info("measure: Successfully uploaded ${mapping.filename}")
                true
            } else {
                logger.error("measure: Failed to upload ${mapping.filename}, response code: ${response.code}")
                false
            }
        }
    }

    private fun createFileUploadRequest(mapping: MappingUpload, file: File): Request {
        val requestBody = file.asRequestBody()
        val requestBuilder = Request.Builder()
            .url(mapping.upload_url)
            .put(requestBody)

        // Add required headers from the API response
        mapping.headers.forEach { (key, value) ->
            requestBuilder.addHeader(key, value)
        }

        return requestBuilder.build()
    }

    private fun <T> executeHttpRequestWithRetry(
        client: okhttp3.OkHttpClient,
        request: Request,
        operationName: String,
        responseHandler: (Response) -> T?,
    ): T? {
        val maxRetries = retriesProperty.get()

        repeat(maxRetries + 1) { attempt ->
            try {
                val response = client.newCall(request).execute()
                response.use { resp ->
                    if (!resp.isSuccessful && shouldRetry(resp.code) && attempt < maxRetries) {
                        logger.warn("measure: $operationName failed with code ${resp.code}, retrying... (attempt ${attempt + 1}/${maxRetries + 1})")
                        return@repeat
                    }
                    return responseHandler(resp)
                }
            } catch (e: IOException) {
                if (attempt < maxRetries) {
                    logger.warn("measure: $operationName failed, retrying... (attempt ${attempt + 1}/${maxRetries + 1}): ${e.message}")
                } else {
                    logger.error("measure: $operationName failed after ${maxRetries + 1} attempts: ${e.message}")
                }
            } catch (e: Exception) {
                logger.error("measure: $operationName failed with unexpected error: ${e.message}")
                return null
            }
        }
        return null
    }

    private fun shouldRetry(responseCode: Int): Boolean {
        return when (responseCode) {
            in 500..599 -> true
            else -> false
        }
    }

    private fun sanitizedCustomHeaders(): Headers {
        val headersBuilder = Headers.Builder()
        requestHeadersProperty.get().filter { it.key !in DISALLOWED_CUSTOM_HEADERS }
            .map { headersBuilder.add(it.key, it.value) }
        return headersBuilder.build()
    }

    private fun logError(response: Response) {
        when (response.code) {
            401 -> logger.error(ERROR_MSG_401)
            413 -> logger.error(ERROR_MSG_413)
            500 -> logger.error(ERROR_MSG_500)
            else -> logger.error("[ERROR]: Failed to upload build info to Measure with response code: ${response.code}. Stack traces will not be symbolicated.")
        }
    }

    @Suppress("OPT_IN_USAGE")
    private fun readManifestData(manifestFile: File): ManifestData =
        Json.decodeFromStream(ManifestData.serializer(), manifestFile.inputStream())

    private fun readBuildMetadata(buildMetadataFile: File): Pair<Long, String> {
        val lines = buildMetadataFile.readLines()
        val buildSize = lines.first().toLong()
        val buildType = lines[1]
        return Pair(buildSize, buildType)
    }
}
