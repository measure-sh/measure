package sh.measure.android.exporter

import okio.BufferedSink
import okio.buffer
import okio.sink
import okio.source
import sh.measure.android.config.ConfigResponse
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.IOException
import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.URL

internal interface HttpClient {
    fun sendJsonRequest(
        url: String,
        method: String,
        headers: Map<String, String>,
        jsonWriter: (BufferedSink) -> Unit,
    ): HttpResponse

    fun uploadFile(
        url: String,
        contentType: String,
        contentEncoding: String?,
        headers: Map<String, String>,
        fileSize: Long,
        fileWriter: (BufferedSink) -> Unit,
    ): HttpResponse

    fun getConfig(url: String, eTag: String?, headers: Map<String, String>): ConfigResponse
}

/**
 * An Http client that uses `HttpURLConnection` to send JSON requests.
 *
 * The main feature of this client is that it streams JSON content directly to the
 * socket, which allows to send large payloads without loading them entirely into the memory. It also
 * configures the `HttpUrlConnection` to `setChunkedStreamingMode` to avoid buffering the request
 * body in memory.
 */
internal class HttpUrlConnectionClient(private val logger: Logger) : HttpClient {
    private val connectionTimeoutMs = 30_000
    private val readTimeoutMs = 10_000
    private val maxRedirects = 5

    override fun sendJsonRequest(
        url: String,
        method: String,
        headers: Map<String, String>,
        jsonWriter: (BufferedSink) -> Unit,
    ): HttpResponse = sendJsonRequestWithRedirects(url, method, headers, jsonWriter, 0)

    private fun sendJsonRequestWithRedirects(
        url: String,
        method: String,
        headers: Map<String, String>,
        jsonWriter: (BufferedSink) -> Unit,
        redirectCount: Int,
    ): HttpResponse {
        if (redirectCount >= maxRedirects) {
            throw IOException("Too many redirects")
        }
        var connection: HttpURLConnection? = null
        try {
            connection = createConnection(url, method, headers)
            val outputStream = getOutputStream(connection)
            logger.log(LogLevel.Debug, "Sending request to measure: $url")
            jsonWriter(outputStream)
            outputStream.flush()
            if (isRedirect(connection.responseCode)) {
                val location = connection.getHeaderField("Location")
                    ?: throw IOException("Redirect location is missing")
                val newUrl = resolveRedirectUrl(url, location)
                connection.disconnect()
                return sendJsonRequestWithRedirects(
                    url = newUrl,
                    method = method,
                    headers = headers,
                    jsonWriter = jsonWriter,
                    redirectCount = redirectCount + 1,
                )
            }
            return processResponse(connection)
        } catch (e: IOException) {
            return HttpResponse.Error.UnknownError(e)
        } finally {
            connection?.disconnect()
        }
    }

    override fun uploadFile(
        url: String,
        contentType: String,
        contentEncoding: String?,
        headers: Map<String, String>,
        fileSize: Long,
        fileWriter: (BufferedSink) -> Unit,
    ): HttpResponse {
        var connection: HttpURLConnection? = null
        return try {
            connection =
                createFileUploadConnection(url, contentType, contentEncoding, headers, fileSize)
            logger.log(LogLevel.Debug, "Uploading file to: $url")
            connection.outputStream.sink().buffer().use { sink ->
                fileWriter(sink)
                sink.flush()
            }
            processResponse(connection)
        } catch (e: IOException) {
            HttpResponse.Error.UnknownError(e)
        } finally {
            connection?.disconnect()
        }
    }

    override fun getConfig(
        url: String,
        eTag: String?,
        headers: Map<String, String>,
    ): ConfigResponse {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = connectionTimeoutMs
                readTimeout = readTimeoutMs
                headers.forEach { (key, value) ->
                    setRequestProperty(key, value)
                }
                eTag?.let { setRequestProperty("If-None-Match", it) }
            }

            logger.log(LogLevel.Debug, "Fetching config from: $url")

            when (val responseCode = connection.responseCode) {
                HttpURLConnection.HTTP_OK -> {
                    val body = connection.inputStream.source().buffer().readString(Charsets.UTF_8)
                    val newETag = connection.getHeaderField("ETag")
                    val cacheControl = parseCacheControlMaxAge(connection.getHeaderField("Cache-Control"))

                    ConfigResponse.Success(
                        body = body,
                        eTag = newETag,
                        cacheControl = cacheControl,
                    )
                }

                HttpURLConnection.HTTP_NOT_MODIFIED -> {
                    ConfigResponse.NotModified
                }

                else -> {
                    logger.log(LogLevel.Error, "Config fetch failed with status: $responseCode")
                    ConfigResponse.Error()
                }
            }
        } catch (e: IOException) {
            logger.log(LogLevel.Debug, "Config fetch failed", e)
            ConfigResponse.Error(e)
        } finally {
            connection?.disconnect()
        }
    }

    private fun parseCacheControlMaxAge(cacheControlHeader: String?): Long {
        if (cacheControlHeader == null) return 0

        return try {
            val maxAgeRegex = "max-age=(\\d+)".toRegex()
            val matchResult = maxAgeRegex.find(cacheControlHeader)
            matchResult?.groupValues?.get(1)?.toLong() ?: 0
        } catch (e: NumberFormatException) {
            logger.log(LogLevel.Error, "Failed to parse Cache-Control max-age", e)
            0
        }
    }

    private fun isRedirect(responseCode: Int): Boolean {
        // Handling only 307 (Temporary Redirect) and 308 (Permanent Redirect) as the redirection
        // status codes.
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
        return responseCode == 307 || responseCode == 308
    }

    @Throws(IOException::class)
    private fun resolveRedirectUrl(baseUrl: String, location: String): String {
        try {
            val base = URL(baseUrl)
            val resolved = URL(base, location)
            return resolved.toString()
        } catch (e: MalformedURLException) {
            throw IOException("Invalid redirect URL", e)
        }
    }

    private fun createConnection(
        url: String,
        method: String,
        headers: Map<String, String>,
    ): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
        requestMethod = method
        doOutput = true
        setChunkedStreamingMode(0)
        connectTimeout = connectionTimeoutMs
        readTimeout = readTimeoutMs
        setRequestProperty("Content-Type", "application/json")
        headers.forEach { (key, value) -> setRequestProperty(key, value) }
    }

    private fun createFileUploadConnection(
        url: String,
        contentType: String,
        contentEncoding: String?,
        headers: Map<String, String>,
        fileSize: Long,
    ): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
        requestMethod = "PUT"
        doOutput = true
        useCaches = false
        if (fileSize > 0) {
            setFixedLengthStreamingMode(fileSize)
        } else {
            setChunkedStreamingMode(0)
        }
        setRequestProperty("Content-Type", contentType)
        contentEncoding?.let { setRequestProperty("Content-Encoding", contentEncoding) }
        headers.forEach { (key, value) ->
            setRequestProperty(key, value)
        }
        connectTimeout = connectionTimeoutMs
        readTimeout = connectionTimeoutMs
    }

    private fun getOutputStream(connection: HttpURLConnection): BufferedSink = if (logger.enabled) {
        LoggingOutputStream(connection.outputStream, logger).sink().buffer()
    } else {
        connection.outputStream.sink().buffer()
    }

    private fun getResponseBody(connection: HttpURLConnection): String? = try {
        when (connection.responseCode) {
            in 200..299 -> {
                connection.inputStream.source().buffer().readString(Charsets.UTF_8)
            }

            else -> {
                connection.errorStream?.source()?.buffer()?.readString(Charsets.UTF_8)
            }
        }
    } catch (_: IOException) {
        null
    }

    private fun processResponse(connection: HttpURLConnection): HttpResponse {
        val body = getResponseBody(connection)
        return when (val responseCode = connection.responseCode) {
            in 200..299 -> HttpResponse.Success(body = body)
            429 -> HttpResponse.Error.RateLimitError(body = body)
            in 400..499 -> HttpResponse.Error.ClientError(responseCode, body)
            in 500..599 -> HttpResponse.Error.ServerError(responseCode, body)
            else -> HttpResponse.Error.UnknownError()
        }
    }
}
