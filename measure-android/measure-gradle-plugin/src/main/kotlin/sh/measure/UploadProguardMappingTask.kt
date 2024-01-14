package sh.measure

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromStream
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.Response
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.TaskAction
import java.io.IOException

private const val HEADER_AUTHORIZATION = "Authorization"
private const val VERSION_CODE = "version_code"
private const val APP_UNIQUE_ID = "app_unique_id"
private const val VERSION_NAME = "version_name"
private const val TYPE = "type"
private const val TYPE_PROGUARD = "proguard"
private const val MAPPING_FILE = "mapping_file"

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

    @get:Input
    abstract val retriesProperty: Property<Int>

    @TaskAction
    fun upload() {
        val manifestDataFile = manifestDataProperty.get().asFile
        val mappingFile = mappingFileProperty.get().asFile

        @Suppress("OPT_IN_USAGE") val manifestData =
            Json.decodeFromStream(ManifestData.serializer(), manifestDataFile.inputStream())
        val client = httpClientProvider.get().client
        val requestBody = with(MultipartBody.Builder()) {
            setType(MultipartBody.FORM)
            addFormDataPart(APP_UNIQUE_ID, manifestData.appUniqueId)
            addFormDataPart(VERSION_CODE, manifestData.versionCode)
            addFormDataPart(VERSION_NAME, manifestData.versionName)
            addFormDataPart(TYPE, TYPE_PROGUARD)
            addFormDataPart(MAPPING_FILE, mappingFile.name, mappingFile.asRequestBody())
        }.build()

        val request: Request = Request.Builder().url(mappingEndpointProperty.get())
            .header(HEADER_AUTHORIZATION, "Bearer ${manifestData.apiKey}").put(requestBody).build()
        try {
            val response = client.executeWithRetry(request, retriesProperty.get())
            if (!response.isSuccessful) {
                throw GradleException("Unable to upload mapping file to Measure")
            }
        } catch (e: IOException) {
            throw GradleException("Unable to upload mapping file to Measure", e)
        }
    }

    private fun OkHttpClient.executeWithRetry(request: Request, maxRetries: Int = 0): Response {
        var retries = 0
        while (true) {
            try {
                val response = this.newCall(request).execute()
                when {
                    response.isSuccessful -> return response
                    response.code == 401 -> throw GradleException("Unable to upload mapping file to Measure, invalid api key")
                    retries < maxRetries -> retries++
                    else -> return response
                }
            } catch (e: IOException) {
                if (retries >= maxRetries) throw GradleException(
                    "Unable to upload mapping file to Measure", e
                )
                retries++
            }
        }
    }
}