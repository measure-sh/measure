package sh.measure

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromStream
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.Response
import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.TaskAction
import java.io.File
import java.io.IOException

private const val HEADER_AUTHORIZATION = "Authorization"
private const val VERSION_CODE = "version_code"
private const val APP_UNIQUE_ID = "app_unique_id"
private const val VERSION_NAME = "version_name"
private const val BUILD_SIZE = "build_size"
private const val BUILD_TYPE = "build_type"
private const val MAPPING_TYPE = "mapping_type"
private const val TYPE_PROGUARD = "proguard"
private const val MAPPING_FILE = "mapping_file"

private const val ERROR_MSG_401 =
    "Failed to upload mapping file to Measure, please check the api-key in manifest"
private const val ERROR_MSG_413 =
    "Failed to upload mapping file to Measure, mapping file size exceeded the maximum allowed limit"
private const val ERROR_MSG_500 =
    "Failed to upload mapping file to Measure, the server encountered an error"

abstract class UploadProguardMappingTask : DefaultTask() {
    init {
        group = MeasurePlugin.GROUP_NAME
        description = "Uploads the proguard mapping file to measure"
    }

    @get:Internal
    abstract val httpClientProvider: Property<MeasureHttpClient>

    @get:Input
    abstract val mappingEndpointProperty: Property<String>

    @get:InputFile
    abstract val mappingFileProperty: RegularFileProperty

    @get:InputFile
    abstract val manifestDataProperty: RegularFileProperty

    @get:InputFile
    abstract val appSizeFileProperty: RegularFileProperty

    @get:Input
    abstract val retriesProperty: Property<Int>

    @TaskAction
    fun upload() {
        val manifestDataFile = manifestDataProperty.get().asFile
        val mappingFile = mappingFileProperty.get().asFile
        val appSizeFile = appSizeFileProperty.get().asFile

        val manifestData = readManifestData(manifestDataFile)
        val appSize = readAppSize(appSizeFile)
        val buildType = readBuildType(appSizeFile)

        val client = httpClientProvider.get().client
        val requestBody = with(MultipartBody.Builder()) {
            setType(MultipartBody.FORM)
            addFormDataPart(APP_UNIQUE_ID, manifestData.appUniqueId)
            addFormDataPart(VERSION_CODE, manifestData.versionCode)
            addFormDataPart(VERSION_NAME, manifestData.versionName)
            appSize?.let {
                addFormDataPart(BUILD_SIZE, it)
            }
            buildType?.let {
                addFormDataPart(BUILD_TYPE, it)
            }
            addFormDataPart(MAPPING_TYPE, TYPE_PROGUARD)
            addFormDataPart(MAPPING_FILE, mappingFile.name, mappingFile.asRequestBody())
        }.build()

        val request: Request = Request.Builder().url(mappingEndpointProperty.get())
            .header(HEADER_AUTHORIZATION, "Bearer ${manifestData.apiKey}").put(requestBody).build()
        try {
            val response = client.executeWithRetry(request, retriesProperty.get()) ?: return
            if (!response.isSuccessful) {
                logger.error("Failed to upload mapping file to Measure, request failed with response code ${response.code}")
                return
            }
        } catch (e: IOException) {
            logger.error("Failed to upload mapping file to Measure, ${e.message}")
            return
        }
    }

    @Suppress("OPT_IN_USAGE")
    private fun readManifestData(manifestDataFile: File) =
        Json.decodeFromStream(ManifestData.serializer(), manifestDataFile.inputStream())

    private fun readAppSize(appSizeFile: File): String? {
        return if (appSizeFile.exists()) {
            appSizeFile.readLines().firstOrNull()
        } else {
            null
        }
    }

    private fun readBuildType(appSizeFile: File): String? {
        return appSizeFile.takeIf { it.exists() }?.readLines()?.getOrNull(1)
    }

    private fun OkHttpClient.executeWithRetry(request: Request, maxRetries: Int = 0): Response? {
        var retries = 0
        while (true) {
            try {
                val response = this.newCall(request).execute()
                when {
                    response.isSuccessful -> return response
                    response.code == 401 -> logger.warn(ERROR_MSG_401)
                    response.code == 413 -> logger.warn(ERROR_MSG_413)
                    response.code == 500 -> logger.warn(ERROR_MSG_500)
                    retries < maxRetries -> retries++
                    else -> return response
                }
            } catch (e: IOException) {
                if (retries >= maxRetries) {
                    logger.error("Failed to upload mapping file to Measure: ${e.message}")
                    break
                }
                retries++
            }
        }
        return null
    }
}