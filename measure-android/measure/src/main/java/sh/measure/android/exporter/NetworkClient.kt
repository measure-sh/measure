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
    fun execute(
        batchId: String,
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): Boolean
}

private const val CONNECTION_TIMEOUT_MS = 30_000L
private const val CALL_TIMEOUT_MS = 20_000L
private const val PATH_EVENTS = "/events"

private const val ATTACHMENT_NAME_PREFIX = "blob-"

internal class NetworkClientImpl(
    private val logger: Logger,
    private val fileStorage: FileStorage,
    private val secretToken: String,
    private val baseUrl: String,
) : NetworkClient {
    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder().connectTimeout(CONNECTION_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .callTimeout(CALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .addInterceptor(SecretTokenHeaderInterceptor(secretToken))
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }).build()
    }

    override fun execute(
        batchId: String,
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): Boolean {
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
        eventPackets: List<EventPacket>, requestBodyBuilder: MultipartBody.Builder
    ) {
        eventPackets.forEach { eventPacket ->
            requestBodyBuilder.addFormDataPart(eventFormDataName, eventPacket.asFormDataPart())
        }
    }

    private fun addAttachmentParts(
        attachmentPackets: List<AttachmentPacket>, requestBodyBuilder: MultipartBody.Builder
    ) {
        attachmentPackets.forEach { attachmentPacket ->
            requestBodyBuilder.addFormDataPart(
                getAttachmentFormDataName(attachmentPacket), null, attachmentPacket.asFormDataPart()
            )
        }
    }

    private fun buildRequest(requestBody: RequestBody, batchId: String): Request {
        return Request.Builder().url("$baseUrl${PATH_EVENTS}").put(requestBody)
            .header("X-Request-ID", batchId).build()
    }

    private fun executeRequest(request: Request): Boolean {
        return try {
            okHttpClient.newCall(request).execute().use {
                if (it.code == 202) { // TODO: check with Debjeet if this should be done for any 2xx response?
                    logger.log(LogLevel.Debug, "Request successful")
                    true
                } else {
                    logger.log(LogLevel.Error, "Request failed with code: ${it.code}")
                    false
                }
            }
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Failed to send request", e)
            false
        }
    }

    private val eventFormDataName = "event"

    private fun getAttachmentFormDataName(attachmentPacket: AttachmentPacket): String =
        "$ATTACHMENT_NAME_PREFIX${attachmentPacket.id}"

    private fun AttachmentPacket.asFormDataPart(): RequestBody {
        return fileStorage.getFile(filePath)?.asRequestBody()
            ?: throw IllegalStateException("No file found at path: $filePath")
    }

    private fun EventPacket.asFormDataPart(): String {
        val data = serializedData ?: if (serializedDataFilePath != null) {
            return fileStorage.getFile(serializedDataFilePath)?.readText()
                ?: throw IllegalStateException("No file found at path: $serializedDataFilePath")
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
}
