package sh.measure.android.exporter

import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage
import java.net.URL

internal interface NetworkClient {
    fun init(baseUrl: String, apiKey: String)
    fun execute(
        batchId: String,
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): HttpResponse
}

internal class NetworkClientImpl(
    private val logger: Logger,
    private val fileStorage: FileStorage,
    private val httpClient: HttpClient = HttpUrlConnectionClient(logger),
    private val multipartDataFactory: MultipartDataFactory = MultipartDataFactoryImpl(
        logger,
        fileStorage,
    ),
) : NetworkClient {
    private var baseUrl: URL? = null
    private var eventsUrl: URL? = null
    private var apiKey: String? = null

    companion object {
        private const val PATH_EVENTS = "/events"
    }

    override fun init(baseUrl: String, apiKey: String) {
        this.baseUrl = parseUrl(baseUrl)
        this.apiKey = apiKey
        this.eventsUrl = this.baseUrl?.let { createEventsUrl(it) }
    }

    override fun execute(
        batchId: String,
        eventPackets: List<EventPacket>,
        attachmentPackets: List<AttachmentPacket>,
    ): HttpResponse {
        validateInitialization()

        val headers = createHeaders(batchId)
        val multipartData = prepareMultipartData(eventPackets, attachmentPackets)

        return try {
            val response =
                httpClient.sendMultipartRequest(eventsUrl.toString(), "PUT", headers, multipartData)
            handleResponse(response)
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to send request", e)
            HttpResponse.Error.UnknownError(e)
        }
    }

    private fun parseUrl(url: String): URL? {
        return try {
            URL(url)
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Invalid API_URL: $baseUrl", e)
            null
        }
    }

    private fun createEventsUrl(baseUrl: URL): URL? {
        return try {
            baseUrl.toURI().resolve(PATH_EVENTS).toURL()
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Invalid API_URL: $baseUrl", e)
            null
        }
    }

    private fun validateInitialization() {
        requireNotNull(baseUrl) { "Base URL not found, events will not be exported" }
        requireNotNull(apiKey) { "API key not found, events will not be exported" }
        requireNotNull(eventsUrl) { "Events URL not found, events will not be exported" }
    }

    private fun createHeaders(batchId: String): Map<String, String> {
        return mapOf(
            "msr-req-id" to batchId,
            "Authorization" to "Bearer $apiKey",
        )
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
