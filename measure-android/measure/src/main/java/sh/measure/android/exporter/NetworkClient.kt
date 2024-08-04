package sh.measure.android.exporter

import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage

internal interface NetworkClient {
    fun init(baseUrl: String, apiKey: String)
    fun execute(
        batchId: String,
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): HttpResponse
}

private const val PATH_EVENTS = "/events"

internal class NetworkClientImpl(
    private val logger: Logger,
    private val fileStorage: FileStorage,
    private val httpClient: HttpClient = HttpUrlConnectionClient(),
    private val multipartDataFactory: MultipartDataFactory = MultipartDataFactoryImpl(
        logger,
        fileStorage,
    ),
) : NetworkClient {
    private var baseUrl: String? = null
    private var apiKey: String? = null

    override fun init(baseUrl: String, apiKey: String) {
        this.baseUrl = baseUrl
        this.apiKey = apiKey
    }

    override fun execute(
        batchId: String,
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): HttpResponse {
        requireNotNull(baseUrl) { "NetworkClient must be initialized before executing requests" }
        requireNotNull(apiKey) { "NetworkClient must be initialized before executing requests" }

        val url = "$baseUrl$PATH_EVENTS"

        val headers = mapOf(
            "msr-req-id" to batchId,
            "Authorization" to "Bearer $apiKey",
        )

        val multipartData = prepareMultipartData(eventPackets, attachmentPackets)

        return try {
            val response = httpClient.sendMultipartRequest(url, "PUT", headers, multipartData)
            handleResponse(response)
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to send request", e)
            HttpResponse.Error.UnknownError(e)
        }
    }

    private fun prepareMultipartData(
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): List<MultipartData> {
        val events = eventPackets.mapNotNull {
            multipartDataFactory.createFromEventPacket(it)
        }
        val attachments = attachmentPackets.mapNotNull {
            multipartDataFactory.createFromAttachmentPacket(it)
        }
        return events + attachments
    }

    private fun handleResponse(response: HttpResponse): HttpResponse {
        return when (response) {
            is HttpResponse.Success -> {
                logger.log(LogLevel.Debug, "Request successful")
                response
            }

            is HttpResponse.Error.RateLimitError -> {
                logger.log(LogLevel.Debug, "Request rate limited, will retry later")
                response
            }

            is HttpResponse.Error.ClientError -> {
                logger.log(LogLevel.Error, "Unable to process request: ${response.code}")
                response
            }

            is HttpResponse.Error.ServerError -> {
                logger.log(LogLevel.Error, "Request failed with code: ${response.code}")
                response
            }

            is HttpResponse.Error.UnknownError -> {
                logger.log(LogLevel.Error, "Request failed with unknown error")
                response
            }
        }
    }
}
