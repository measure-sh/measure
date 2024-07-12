package sh.measure.android.exporter

import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage
import java.io.IOException
import java.util.concurrent.TimeUnit

internal interface NetworkClient {
    fun init(baseUrl: String, apiKey: String)
    fun execute(
        batchId: String,
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): HttpResponse<Nothing?>
}

private const val CONNECTION_TIMEOUT_MS = 30_000L
private const val CALL_TIMEOUT_MS = 20_000L
private const val PATH_EVENTS = "/events"

private const val ATTACHMENT_NAME_PREFIX = "blob-"

internal class NetworkClientImpl(
    private val logger: Logger,
    private val fileStorage: FileStorage,
) : NetworkClient {
    private val eventFormDataName = "event"
    private var okHttpClient: OkHttpClient? = null
    private var baseUrl: String? = null

    override fun init(baseUrl: String, apiKey: String) {
        this.baseUrl = baseUrl
        okHttpClient =
            OkHttpClient.Builder().connectTimeout(CONNECTION_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .callTimeout(CALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .addInterceptor(SecretTokenHeaderInterceptor(apiKey)).addInterceptor(
                    HttpLoggingInterceptor().apply {
                        level = HttpLoggingInterceptor.Level.BODY
                    },
                ).build()
    }

    override fun execute(
        batchId: String,
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): HttpResponse<Nothing?> {
        val requestBody = buildRequestBody(eventPackets, attachmentPackets)
        val request: Request = buildRequest(requestBody, batchId)
        return executeRequest(request)
    }

    private fun buildRequestBody(
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): RequestBody {
        val requestBodyBuilder = MultipartBody.Builder().setType(MultipartBody.FORM)

        addEventParts(eventPackets, requestBodyBuilder)
        addAttachmentParts(attachmentPackets, requestBodyBuilder)

        return requestBodyBuilder.build()
    }

    private fun addEventParts(
        eventPackets: List<EventPacket>,
        requestBodyBuilder: MultipartBody.Builder,
    ) {
        eventPackets.forEach { eventPacket ->
            requestBodyBuilder.addFormDataPart(
                eventFormDataName,
                eventPacket.asFormDataPart(fileStorage),
            )
        }
    }

    private fun addAttachmentParts(
        attachmentPackets: List<AttachmentPacket>,
        requestBodyBuilder: MultipartBody.Builder,
    ) {
        attachmentPackets.forEach { attachmentPacket ->
            val name = getAttachmentFormDataName(attachmentPacket)
            requestBodyBuilder.addFormDataPart(
                name,
                name,
                attachmentPacket.asFormDataPart(fileStorage),
            )
        }
    }

    private fun buildRequest(requestBody: RequestBody, batchId: String): Request {
        requireNotNull(baseUrl) { "NetworkClient must be initialized before executing requests" }
        return Request.Builder().url("$baseUrl${PATH_EVENTS}").put(requestBody)
            .header("msr-req-id", batchId).build()
    }

    private fun executeRequest(request: Request): HttpResponse<Nothing?> {
        requireNotNull(okHttpClient) { "NetworkClient must be initialized before executing requests" }
        return try {
            okHttpClient!!.newCall(request).execute().use {
                when (it.code) {
                    in 200..299 -> {
                        logger.log(LogLevel.Debug, "Request successful")
                        HttpResponse.Success()
                    }

                    429 -> {
                        logger.log(
                            LogLevel.Debug,
                            "Request rate limited, will retry later",
                        )
                        HttpResponse.Error.RateLimitError()
                    }

                    in 400..499 -> {
                        logger.log(LogLevel.Error, "Unable to process request: ${it.code}")
                        HttpResponse.Error.ClientError()
                    }

                    in 500..599 -> {
                        logger.log(LogLevel.Error, "Request failed with code: ${it.code}")
                        HttpResponse.Error.ServerError()
                    }

                    else -> {
                        logger.log(LogLevel.Error, "Request failed with unknown code: ${it.code}")
                        HttpResponse.Error.UnknownError()
                    }
                }
            }
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Failed to send request", e)
            HttpResponse.Error.UnknownError(e)
        }
    }

    private fun getAttachmentFormDataName(attachmentPacket: AttachmentPacket): String =
        "$ATTACHMENT_NAME_PREFIX${attachmentPacket.id}"

    private fun AttachmentPacket.asFormDataPart(fileStorage: FileStorage): RequestBody {
        return fileStorage.getFile(filePath)?.asRequestBody()
            ?: throw IllegalStateException("No file found at path: $filePath")
    }
}
