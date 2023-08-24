package sh.measure.sample.network

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import okio.BufferedSink
import sh.measure.sample.events.EventsRequest
import sh.measure.sample.logger.LogLevel
import sh.measure.sample.logger.Logger
import java.io.IOException
import java.util.concurrent.TimeUnit

private const val CONNECTION_TIMEOUT_MS = 5_000L
private const val CALL_TIMEOUT_MS = 15_000L
private const val CONTENT_TYPE_JSON = "application/json"
private const val PATH_EVENTS = "/events"

/**
 * An HTTP client that uses OkHttp.
 *
 * TODO(abhay): This is temporary. We can use HttpUrlConnection instead and remove the OkHttp
 *  dependency. For now this helps in testing things out quickly.
 */
internal class HttpClientOkHttp(private val logger: Logger, private val baseUrl: String) :
    HttpClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(CONNECTION_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .callTimeout(CALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .build()

    @OptIn(ExperimentalSerializationApi::class)
    override fun sendEvents(events: EventsRequest) {
        val requestBody = object : RequestBody() {
            override fun contentType() = CONTENT_TYPE_JSON.toMediaType()

            override fun writeTo(sink: BufferedSink) {
                Json.encodeToStream(EventsRequest.serializer(), events, sink.outputStream())
            }
        }

        val request = Request.Builder().url(baseUrl + PATH_EVENTS).post(requestBody).build()
        client.newCall(request).enqueue(CallbackAdapter(logger))
    }
}

internal class CallbackAdapter(private val logger: Logger) : Callback {
    override fun onFailure(call: Call, e: IOException) {
        logger.log(LogLevel.Error, "Error sending events", e)
    }

    override fun onResponse(call: Call, response: Response) {
        when (response.code) {
            200 -> logger.log(LogLevel.Debug, "Events sent successfully")
            else -> logger.log(
                LogLevel.Error,
                "Error sending events. Response code: ${response.code}"
            )
        }
    }
}
