package sh.measure.android.exporter

import okhttp3.Call
import okhttp3.Callback
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

internal interface NetworkClient {
    fun enqueue(
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
        callback: NetworkCallback
    )
}

internal interface NetworkCallback {
    fun onSuccess()
    fun onError()
}

private const val CONNECTION_TIMEOUT_MS = 30_000L
private const val CALL_TIMEOUT_MS = 20_000L
private const val PATH_EVENTS = "/events"

private const val ATTACHMENT_NAME_PREFIX = "blob-"

internal class NetworkClientImpl(
    private val logger: Logger,
    private val secretToken: String,
    private val baseUrl: String,
) : NetworkClient {
    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder().connectTimeout(CONNECTION_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .callTimeout(CALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .addInterceptor(SecretTokenHeaderInterceptor(secretToken)).addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BODY
                },
            ).build()
    }

    override fun enqueue(
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
        callback: NetworkCallback
    ) {
        val requestBodyBuilder = MultipartBody.Builder().setType(MultipartBody.FORM)

        eventPackets.forEach { eventPacket ->
            requestBodyBuilder.addFormDataPart("event", eventPacket.asFormDataPart())
        }
        attachmentPackets.forEach { attachmentPacket ->
            requestBodyBuilder.addFormDataPart(
                getAttachmentFormDataName(attachmentPacket),
                null,
                attachmentPacket.asFormDataPart()
            )
        }
        val requestBody = requestBodyBuilder.build()
        val request: Request =
            Request.Builder().url("$baseUrl${PATH_EVENTS}").put(requestBody).build()
        okHttpClient.newCall(request).enqueue(CallbackAdapter(logger, callback))
    }

    private fun getAttachmentFormDataName(attachmentPacket: AttachmentPacket) =
        "$ATTACHMENT_NAME_PREFIX${attachmentPacket.id}"

    private fun EventPacket.asFormDataPart(): String {
        val data = serializedData ?: if (serializedDataFilePath != null) {
            readFileText(serializedDataFilePath)
        } else {
            throw IllegalStateException("EventPacket must have either serializedData or serializedDataFilePath")
        }
        return """
            {
                "eventId": "$eventId",
                "sessionId": "$sessionId",
                "timestamp": $timestamp,
                "type": "$type",
                "$type": $data,
                "attachments": $serializedAttachments,
                "attributes": $serializedAttributes
            }
            """.trimIndent()
    }

    private fun readFileText(path: String): String {
        val file = File(path)
        if (file.exists()) {
            return file.readText()
        } else {
            throw IllegalStateException("No file found at path: $path")
        }
    }

    private fun AttachmentPacket.asFormDataPart(): RequestBody {
        val file = File(filePath)
        if (file.exists()) {
            return file.asRequestBody()
        } else {
            throw IllegalStateException("No file found at path: $filePath")
        }
    }

    internal class CallbackAdapter(
        private val logger: Logger, private val callback: NetworkCallback?
    ) : Callback {
        override fun onFailure(call: Call, e: IOException) {
            logger.log(LogLevel.Error, "Error sending request", e)
            callback?.onError()
        }

        override fun onResponse(call: Call, response: Response) {
            when (response.code) {
                202 -> {
                    logger.log(LogLevel.Debug, "Events sent successfully")
                    callback?.onSuccess()
                }

                else -> {
                    logger.log(
                        LogLevel.Error,
                        "Error sending request. Response code: ${response.code}",
                    )
                    logger.log(LogLevel.Error, "Response body: ${response.body?.string()}")
                    callback?.onError()
                }
            }
        }
    }
}
