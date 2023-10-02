package sh.measure.android.network

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.MultipartBody.Part
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import okio.BufferedSink
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionReport
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit


private const val CONNECTION_TIMEOUT_MS = 30_000L
private const val CALL_TIMEOUT_MS = 20_000L
private const val CONTENT_TYPE_JSON = "application/json; charset=utf-8"
private const val PATH_SESSION = "/sessions"

/**
 * An HTTP client that uses OkHttp to send data to the server.
 */
internal class HttpClientOkHttp(
    private val logger: Logger, private val baseUrl: String, secretToken: String
) : HttpClient {

    private val client =
        OkHttpClient.Builder().connectTimeout(CONNECTION_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .callTimeout(CALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .addInterceptor(SecretTokenHeaderInterceptor(secretToken))
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }).build()

    override fun sendSessionReportMultipart(
        sessionReport: SessionReport, callback: Transport.Callback?
    ) {
        fun createJsonPart(name: String, filename: String, file: File): Part {
            val headers = Headers.headersOf(
                "Content-Disposition", "form-data; name=\"$name\"; filename=\"$filename\""
            )
            val contentType = CONTENT_TYPE_JSON.toMediaType()
            val body = file.asRequestBody(contentType)
            return Part.create(headers, body)
        }

        logger.log(LogLevel.Debug, "Sending session report: ${sessionReport.session_id}")
        val requestBody = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart(name = "session_id", value = sessionReport.session_id)
            .addFormDataPart(name = "timestamp", value = sessionReport.timestamp).addPart(
                createJsonPart(
                    name = "resource", filename = "resource.json", file = sessionReport.resourceFile
                )
            ).addPart(
                createJsonPart(
                    name = "events", filename = "events.json", file = sessionReport.eventsFile
                )
            ).build()
        val request: Request =
            Request.Builder().url("$baseUrl$PATH_SESSION").post(requestBody).build()
        client.newCall(request).enqueue(CallbackAdapter(logger, callback))
    }

    @OptIn(ExperimentalSerializationApi::class)
    override fun sendSessionReport(
        sessionReportRequest: SessionReportRequest, callback: Transport.Callback?
    ) {
        val requestBody = object : RequestBody() {
            override fun contentType() = CONTENT_TYPE_JSON.toMediaType()
            override fun writeTo(sink: BufferedSink) {
                Json.encodeToStream(sessionReportRequest, sink.outputStream())
            }
        }
        val request: Request =
            Request.Builder().url("$baseUrl$PATH_SESSION").post(requestBody).build()
        client.newCall(request).enqueue(CallbackAdapter(logger, callback))
    }
}

internal class CallbackAdapter(private val logger: Logger, private val callback: Transport.Callback?) :
    Callback {
    override fun onFailure(call: Call, e: IOException) {
        logger.log(LogLevel.Error, "Error sending request", e)
    }

    override fun onResponse(call: Call, response: Response) {
        when (response.code) {
            202 -> {
                logger.log(LogLevel.Debug, "Events sent successfully")
                callback?.onSuccess()
            }

            else -> {
                logger.log(
                    LogLevel.Error, "Error sending request. Response code: ${response.code}"
                )
                logger.log(LogLevel.Error, "Response body: ${response.body?.string()}")
                callback?.onFailure()
            }
        }
    }
}
