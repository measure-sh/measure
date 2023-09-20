package sh.measure.android.network

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import okio.BufferedSink
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionReport
import java.io.IOException
import java.util.concurrent.TimeUnit

private const val CONNECTION_TIMEOUT_MS = 5_000L
private const val CALL_TIMEOUT_MS = 10_000L
private const val CONTENT_TYPE_JSON = "application/json; charset=utf-8"
private const val PATH_SESSION = "/sessions"

/**
 * An HTTP client that uses OkHttp to send data to the server.
 *
 * TODO(abhay): This is temporary. We can use HttpUrlConnection instead and remove the OkHttp
 *  dependency. For now this helps in testing things out quickly.
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

    @OptIn(ExperimentalSerializationApi::class)
    override fun sendSessionReport(sessionRequest: SessionReport, callback: Transport.Callback?) {
        val requestBody = object : RequestBody() {
            override fun contentType(): MediaType {
                return CONTENT_TYPE_JSON.toMediaType()
            }

            override fun writeTo(sink: BufferedSink) {
                Json.encodeToStream(sessionRequest, sink.outputStream())
            }

        }
        val request = Request.Builder().url("$baseUrl$PATH_SESSION")
            .addHeader("Content-Type", CONTENT_TYPE_JSON).put(requestBody).build()

        client.newCall(request).enqueue(CallbackAdapter(logger, callback))
    }
}

internal class CallbackAdapter(private val logger: Logger, private val callback: Transport.Callback?) :
    Callback {
    override fun onFailure(call: Call, e: IOException) {
        logger.log(LogLevel.Error, "Error sending events", e)
    }

    override fun onResponse(call: Call, response: Response) {
        when (response.code) {
            202 -> {
                logger.log(LogLevel.Debug, "Events sent successfully")
                callback?.onSuccess()
            }

            else -> {
                logger.log(
                    LogLevel.Error, "Error sending events. Response code: ${response.code}"
                )
                callback?.onFailure()
            }
        }
    }
}
