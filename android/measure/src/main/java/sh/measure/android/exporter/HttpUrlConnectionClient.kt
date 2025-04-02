package sh.measure.android.exporter

import okio.BufferedSink
import okio.Source
import okio.buffer
import okio.sink
import okio.source
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.URL

internal interface HttpClient {
    fun sendMultipartRequest(
        url: String,
        method: String,
        headers: Map<String, String>,
        multipartData: List<MultipartData>,
    ): HttpResponse
}

/**
 * An Http client that uses `HttpURLConnection` to send multipart requests. This class
 * can be extended to support non-multipart requests in future.
 *
 * The main feature of this client is that it streams files part of the request directly to the
 * socket, which allows to send large files without loading them entirely into the memory. It also
 * configures the `HttpUrlConnection` to `setChunkedStreamingMode` to avoid buffering the request
 * body in memory.
 */
internal class HttpUrlConnectionClient(private val logger: Logger) : HttpClient {
    private val connectionTimeoutMs = 30_000
    private val readTimeoutMs = 10_000
    private val boundary = "--boundary-7MA4YWxkTrZu0gW"
    private val maxRedirects = 5

    override fun sendMultipartRequest(
        url: String,
        method: String,
        headers: Map<String, String>,
        multipartData: List<MultipartData>,
    ): HttpResponse {
        return sendMultiPartRequestWithRedirects(url, method, headers, multipartData, 0)
    }

    private fun sendMultiPartRequestWithRedirects(
        url: String,
        method: String,
        headers: Map<String, String>,
        multipartData: List<MultipartData>,
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
            streamMultipartData(outputStream, multipartData)
            if (isRedirect(connection.responseCode)) {
                val location = connection.getHeaderField("Location")
                    ?: throw IOException("Redirect location is missing")
                val newUrl = resolveRedirectUrl(url, location)
                connection.disconnect()
                return sendMultiPartRequestWithRedirects(
                    url = newUrl,
                    method = method,
                    headers = headers,
                    multipartData = multipartData,
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

    private fun isRedirect(responseCode: Int): Boolean {
        // Handling only 307 (Temporary Redirect) and 308 (Permanent Redirect) as the redirection
        // status codes.
        // 301, 302, and 303 change the method of the request to GET which is not suitable for
        // multipart requests.
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
    ): HttpURLConnection {
        return (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            doOutput = true
            setChunkedStreamingMode(0)
            connectTimeout = connectionTimeoutMs
            readTimeout = readTimeoutMs
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            headers.forEach { (key, value) -> setRequestProperty(key, value) }
        }
    }

    private fun streamMultipartData(
        outputStream: BufferedSink,
        multipartData: List<MultipartData>,
    ) {
        multipartData.forEach { data ->
            when (data) {
                is MultipartData.FormField -> writeFormField(outputStream, data)
                is MultipartData.FileData -> writeFileData(outputStream, data)
            }
        }

        writeClosingBoundary(outputStream)
    }

    private fun writeBoundary(sink: BufferedSink) {
        sink.writeUtf8("--$boundary\r\n")
    }

    private fun writeHeaders(
        sink: BufferedSink,
        headers: Map<String, String>,
    ) {
        headers.forEach { (key, value) ->
            sink.writeUtf8("$key: $value\r\n")
        }
        sink.writeUtf8("\r\n")
    }

    private fun writeContent(sink: BufferedSink, content: String) {
        sink.writeUtf8(content)
        sink.writeUtf8("\r\n")
        sink.flush()
    }

    private fun writeClosingBoundary(sink: BufferedSink) {
        sink.writeUtf8("--$boundary--\r\n")
        sink.flush()
    }

    private fun writeFormField(sink: BufferedSink, data: MultipartData.FormField) {
        val (headers, content) = getFormFieldPart(data)
        writeBoundary(sink)
        writeHeaders(sink, headers)
        writeContent(sink, content)
    }

    private fun writeFileData(sink: BufferedSink, data: MultipartData.FileData) {
        val (headers, source) = getFileDataPart(data)
        writeBoundary(sink)
        writeHeaders(sink, headers)
        sink.writeAll(source)
        sink.writeUtf8("\r\n")
        sink.flush()
    }

    private fun getFormFieldPart(data: MultipartData.FormField): Pair<Map<String, String>, String> {
        val headers = mapOf(
            "Content-Disposition" to "form-data; name=\"${data.name}\"",
        )
        return headers to data.value
    }

    private fun getFileDataPart(data: MultipartData.FileData): Pair<Map<String, String>, Source> {
        val headers = mapOf(
            "Content-Disposition" to "form-data; name=\"${data.name}\"; filename=\"${data.filename}\"",
        )
        return headers to data.inputStream.source()
    }

    private fun getOutputStream(connection: HttpURLConnection): BufferedSink {
        return if (logger.enabled) {
            LoggingOutputStream(connection.outputStream, logger).sink().buffer()
        } else {
            connection.outputStream.sink().buffer()
        }
    }

    private fun getResponseBody(connection: HttpURLConnection): String? {
        return try {
            when (connection.responseCode) {
                in 200..299 -> {
                    connection.inputStream.source().buffer().readString(Charsets.UTF_8)
                }

                else -> {
                    connection.errorStream?.source()?.buffer()?.readString(Charsets.UTF_8)
                }
            }
        } catch (e: IOException) {
            null
        }
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

internal sealed class MultipartData {
    data class FormField(val name: String, val value: String) : MultipartData()
    data class FileData(
        val name: String,
        val filename: String,
        val inputStream: InputStream,
    ) : MultipartData()
}
