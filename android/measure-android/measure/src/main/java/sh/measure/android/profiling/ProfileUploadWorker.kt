package sh.measure.android.profiling

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import okio.IOException
import okio.source
import sh.measure.android.exporter.HttpResponse
import sh.measure.android.exporter.HttpUrlConnectionClient
import sh.measure.android.logger.AndroidLogger
import sh.measure.android.logger.LogLevel
import java.io.File

/**
 * Uploads a single profile artifact described entirely by the worker's input data: the file path,
 * signed URL, content type and headers. The worker is self-contained, it never opens the SDK
 * database, so it cannot contend with the in-process exporter or cleanup, and it does not depend on
 * the SDK being initialized in this process.
 *
 * Retries with WorkManager backoff only on transient or server errors. A client error (including an
 * expired signed URL, which the server rejects with a 4xx) or a missing file is terminal: the file
 * is removed and the work ends without rescheduling.
 *
 * References `androidx.work` types directly and is only loaded when WorkManager is on the classpath.
 */
internal class ProfileUploadWorker(
    context: Context,
    params: WorkerParameters,
) : Worker(context, params) {
    override fun doWork(): Result {
        val logger = AndroidLogger(enabled = false)
        val path = inputData.getString(KEY_FILE_PATH) ?: return Result.failure()
        val url = inputData.getString(KEY_UPLOAD_URL) ?: return Result.failure()
        val contentType = inputData.getString(KEY_CONTENT_TYPE) ?: DEFAULT_CONTENT_TYPE
        val contentEncoding = inputData.getString(KEY_CONTENT_ENCODING)
        val headers = decodeHeaders(inputData.getString(KEY_HEADERS))

        val file = File(path)
        if (!file.exists() || !file.canRead()) {
            // The file was already removed; nothing left to upload.
            return Result.success()
        }

        val httpClient = HttpUrlConnectionClient(logger)
        return try {
            val response = httpClient.uploadFile(
                url = url,
                contentType = contentType,
                contentEncoding = contentEncoding,
                headers = headers,
                fileSize = file.length(),
            ) { sink ->
                sink.writeAll(file.source())
            }
            when (response) {
                is HttpResponse.Success -> {
                    file.delete()
                    Result.success()
                }

                is HttpResponse.Error.ClientError -> {
                    logger.log(
                        LogLevel.Error,
                        "ProfileUpload: ${response.code} for upload, dropping profile",
                    )
                    file.delete()
                    Result.failure()
                }

                else -> Result.retry()
            }
        } catch (_: IOException) {
            Result.retry()
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "ProfileUpload: failed to upload profile", e)
            Result.failure()
        }
    }

    private fun decodeHeaders(json: String?): Map<String, String> {
        if (json.isNullOrEmpty()) {
            return emptyMap()
        }
        return try {
            Json.decodeFromString(MapSerializer(String.serializer(), String.serializer()), json)
        } catch (e: Exception) {
            emptyMap()
        }
    }

    companion object {
        const val KEY_FILE_PATH = "file_path"
        const val KEY_UPLOAD_URL = "upload_url"
        const val KEY_CONTENT_TYPE = "content_type"
        const val KEY_CONTENT_ENCODING = "content_encoding"
        const val KEY_HEADERS = "headers"
        private const val DEFAULT_CONTENT_TYPE = "application/octet-stream"
    }
}
