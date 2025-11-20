package sh.measure.android.exporter

import okio.source
import sh.measure.android.config.ConfigProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage
import java.net.URL

internal interface NetworkClient {
    fun init(baseUrl: String, apiKey: String)
    fun execute(
        batchId: String,
        eventPackets: List<EventPacket>,
        spanPackets: List<SpanPacket>,
    ): HttpResponse
}

internal class NetworkClientImpl(
    private val logger: Logger,
    private val fileStorage: FileStorage,
    private val httpClient: HttpClient = HttpUrlConnectionClient(logger),
    private val configProvider: ConfigProvider,
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
        spanPackets: List<SpanPacket>,
    ): HttpResponse {
        if (!isInitialized()) {
            // Handling this case as a HTTP response to make error handling consistent
            // with other network errors. This can only happen if the API_URL or API_KEY are
            // not correctly set.
            return HttpResponse.Error.UnknownError(UninitializedPropertyAccessException("Unable to initialize network client, please check the API_KEY and API_URL"))
        }

        val headers = createHeaders(batchId)

        return try {
            httpClient.sendJsonRequest(eventsUrl.toString(), "PUT", headers) { sink ->
                writeJsonPayload(sink, eventPackets, spanPackets)
            }
        } catch (e: Exception) {
            HttpResponse.Error.UnknownError(e)
        }
    }

    private fun parseUrl(url: String): URL? = try {
        URL(url)
    } catch (e: Exception) {
        logger.log(LogLevel.Error, "Failed to send request: invalid API_URL", e)
        null
    }

    private fun createEventsUrl(baseUrl: URL): URL? = try {
        baseUrl.toURI().resolve(PATH_EVENTS).toURL()
    } catch (e: Exception) {
        logger.log(LogLevel.Error, "Failed to send request: invalid API_URL", e)
        null
    }

    private fun isInitialized(): Boolean = !(baseUrl == null || eventsUrl == null || apiKey == null)

    private fun createHeaders(batchId: String): Map<String, String> {
        val defaultHeaders = mapOf(
            "msr-req-id" to batchId,
            "Authorization" to "Bearer $apiKey",
        )

        val customHeaders = sanitizedCustomHeaders()
        return if (customHeaders != null) {
            defaultHeaders + customHeaders
        } else {
            defaultHeaders
        }
    }

    private fun writeJsonPayload(
        sink: okio.BufferedSink,
        eventPackets: List<EventPacket>,
        spanPackets: List<SpanPacket>,
    ) {
        sink.writeUtf8("{\"events\":[")

        eventPackets.forEachIndexed { index, event ->
            if (index > 0) sink.writeUtf8(",")
            writeEventPacket(sink, event)
        }

        sink.writeUtf8("],\"spans\":[")

        spanPackets.forEachIndexed { index, span ->
            if (index > 0) sink.writeUtf8(",")
            writeSpanPacket(sink, span)
        }

        sink.writeUtf8("]}")
    }

    private fun writeEventPacket(sink: okio.BufferedSink, event: EventPacket) {
        sink.writeUtf8("{\"id\":\"${event.eventId}\"")
        sink.writeUtf8(",\"session_id\":\"${event.sessionId}\"")
        sink.writeUtf8(",\"user_triggered\":${event.userTriggered}")
        sink.writeUtf8(",\"timestamp\":\"${event.timestamp}\"")
        sink.writeUtf8(",\"type\":\"${event.type.value}\"")

        // Write event data
        sink.writeUtf8(",\"${event.type.value}\":")
        when {
            event.serializedData != null -> {
                sink.writeUtf8(event.serializedData)
            }
            event.serializedDataFilePath != null -> {
                streamFileContent(sink, event.serializedDataFilePath)
            }
            else -> {
                sink.writeUtf8("null")
            }
        }

        // Write attachments
        sink.writeUtf8(",\"attachments\":")
        if (event.serializedAttachments != null) {
            sink.writeUtf8(event.serializedAttachments)
        } else {
            sink.writeUtf8("null")
        }

        // Write attributes
        sink.writeUtf8(",\"attribute\":${event.serializedAttributes}")

        // Write user defined attributes
        sink.writeUtf8(",\"user_defined_attribute\":")
        if (event.serializedUserDefinedAttributes != null) {
            sink.writeUtf8(event.serializedUserDefinedAttributes)
        } else {
            sink.writeUtf8("null")
        }

        sink.writeUtf8("}")
    }

    private fun writeSpanPacket(sink: okio.BufferedSink, span: SpanPacket) {
        val serialized = sh.measure.android.serialization.jsonSerializer.encodeToString(
            SpanPacket.serializer(),
            span,
        )
        sink.writeUtf8(serialized)
    }

    private fun streamFileContent(sink: okio.BufferedSink, filePath: String) {
        val file = fileStorage.getFile(filePath)
        if (file == null) {
            sink.writeUtf8("null")
            return
        }

        val source = file.inputStream().source()
        try {
            sink.writeAll(source)
        } finally {
            source.close()
        }
    }

    private fun sanitizedCustomHeaders(): Map<String, String>? {
        val requestHeaderProvider = configProvider.requestHeadersProvider ?: return null

        return requestHeaderProvider.getRequestHeaders()
            .filter { it.key !in configProvider.disallowedCustomHeaders }
            .toMap()
    }
}
