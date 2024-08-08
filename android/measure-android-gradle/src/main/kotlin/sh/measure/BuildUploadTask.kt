package sh.measure

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromStream
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.Response
import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.Optional
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
private const val BUILDS_PATH = "builds"

private const val ERROR_MSG_401 =
    "[ERROR]: Failed to upload mapping file to Measure, please check the api-key in manifest. Stack traces will not be symbolicated."
private const val ERROR_MSG_413 =
    "[ERROR]: Failed to upload mapping file to Measure, mapping file size exceeded the maximum allowed limit.  Stack traces will not be symbolicated."
private const val ERROR_MSG_500 =
    "[ERROR]: Failed to upload mapping file to Measure, the server encountered an error, try again later. Stack traces will not be symbolicated."

abstract class BuildUploadTask : DefaultTask() {
    init {
        group = MeasurePlugin.GROUP_NAME
        description = "Uploads the proguard mapping file to measure"
    }

    @get:Internal
    abstract val httpClientProvider: Property<MeasureHttpClient>

    @get:Optional
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
        val mappingFile = mappingFileProperty.getOrNull()?.asFile
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
            mappingFile?.let {
                addFormDataPart(MAPPING_FILE, it.name, it.asRequestBody())
                addFormDataPart(MAPPING_TYPE, TYPE_PROGUARD)
            } ?: logger.warn("[WARNING]: mapping file not found, symbolication will not work")
            addFormDataPart(BUILD_SIZE, appSize)
            addFormDataPart(BUILD_TYPE, buildType)
        }.build()
        val url = "${manifestData.apiUrl}/${BUILDS_PATH}"
        val request: Request = Request.Builder().url(url)
            .header(HEADER_AUTHORIZATION, "Bearer ${manifestData.apiKey}").put(requestBody).build()
        try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                logError(response)
            }
        } catch (e: IOException) {
            logger.error("[ERROR]: Failed to upload mapping file to Measure, ${e.message}")
            return
        }
    }

    private fun logError(response: Response) {
        when (response.code) {
            401 -> logger.error(ERROR_MSG_401)
            413 -> logger.error(ERROR_MSG_413)
            500 -> logger.error(ERROR_MSG_500)
            else -> logger.error("[ERROR]: Failed to upload mapping file to Measure with response code: ${response.code}. Stack traces will not be symbolicated.")
        }
    }

    @Suppress("OPT_IN_USAGE")
    private fun readManifestData(manifestDataFile: File) =
        Json.decodeFromStream(ManifestData.serializer(), manifestDataFile.inputStream())

    private fun readAppSize(appSizeFile: File): String {
        return appSizeFile.readLines().first()
    }

    private fun readBuildType(appSizeFile: File): String {
        return appSizeFile.readLines()[1]
    }
}